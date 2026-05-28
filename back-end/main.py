import json
import logging
import os
import re
import time
import urllib.request
from typing import List

import uvicorn
from database.database import (
    Curriculum,
    Lesson,
    Projects,
    User,
    create_db_tables,
    getSessionLocal,
    migrate_schema,
)
from fastapi import Body, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from models.models import (
    EmailVerificationRequest,
    FirebaseTokenRequest,
    LoginRequest,
    ProjectsCreate,
    RegisterRequest,
    SessionTokenRequest,
    UpdateActiavtedRequest,
    UpdateBetaTesterRequest,
    UpdateUserPasswordRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UserResponse,
    UserRole,
)
from sqlalchemy.exc import IntegrityError
from utils.utils_hash import get_hashed, verify_hashed
from utils.utils_jwt import create_access_token, verify_access_token

logger = logging.getLogger("uvicorn")
SessionLocal = getSessionLocal()

# Database creation
create_db_tables()

# FastAPI app
app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000", "http://localhost:5000" # Add other origins as needed
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],#origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
_firebase_certs_cache = {'certs': {}, 'expires_at': 0}


def get_firebase_project_id():
    project_id = os.getenv('FIREBASE_PROJECT_ID')
    if not project_id:
        raise RuntimeError('FIREBASE_PROJECT_ID is required for Firebase token verification')
    return project_id


def get_firebase_public_certs():
    now = time.time()
    if _firebase_certs_cache['certs'] and _firebase_certs_cache['expires_at'] > now:
        return _firebase_certs_cache['certs']

    with urllib.request.urlopen(FIREBASE_CERTS_URL, timeout=5) as response:
        certs = json.loads(response.read().decode('utf-8'))
        cache_control = response.headers.get('Cache-Control', '')

    max_age_match = re.search(r'max-age=(\d+)', cache_control)
    max_age = int(max_age_match.group(1)) if max_age_match else 3600
    _firebase_certs_cache['certs'] = certs
    _firebase_certs_cache['expires_at'] = now + max_age
    return certs


def verify_firebase_id_token(id_token: str):
    project_id = get_firebase_project_id()
    headers = jwt.get_unverified_header(id_token)
    key_id = headers.get('kid')
    cert = get_firebase_public_certs().get(key_id)
    if not cert:
        raise JWTError('Firebase token has an unknown key ID')

    decoded_token = jwt.decode(
        id_token,
        cert,
        algorithms=['RS256'],
        audience=project_id,
        issuer=f'https://securetoken.google.com/{project_id}',
    )
    decoded_token['uid'] = decoded_token.get('uid') or decoded_token.get('user_id') or decoded_token.get('sub')
    return decoded_token

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Function to create admin user if not exists
def create_admin_user():
    db = SessionLocal()
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    admin_password = os.getenv('ADMIN_PASSWORD', 'admin')  
    admin_email =  os.getenv('ADMIN_EMAIL', 'admin@gmail.com')  
    admin_user = get_user(db, admin_username)
    if not admin_user:
        hashed_password = get_hashed(admin_password)
        new_admin = User(
            username=admin_username,
            hashed_password=hashed_password,
            firstname= os.getenv('ADMIN_FIRSTNAME', 'Admin'),
            lastname= os.getenv('ADMIN_LASTNAME', 'Admin'),
            email=admin_email,
            role=UserRole.ADMIN,
            beta_tester=False,
            activated=True  # Ensure admin is activated
        )
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
        logger.info("Admin user created")
    else:
        logger.info("Admin user already exists")
    db.close()

@app.on_event("startup")
def on_startup():
    migrate_schema()
    create_admin_user()


def get_user(db, username: str):
    return db.query(User).filter(User.username == username).first()

def provider_allows_local_login(provider: str) -> bool:
    providers = {p.strip().lower() for p in (provider or '').split(',')}
    return 'local' in providers


def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not provider_allows_local_login(user.provider):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Please sign in with your social login provider.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not verify_hashed(password, user.hashed_password):
        return False
    return user


def build_firebase_username(db, display_name: str, email: str, firebase_uid: str, current_user=None):
    base_username = re.sub(r'[^a-zA-Z0-9_-]+', '-', display_name.strip().lower()).strip('-')
    if not base_username or base_username == 'user':
        base_username = re.sub(r'[^a-zA-Z0-9_-]+', '-', email.split('@')[0].lower()).strip('-')
    if not base_username or base_username == 'user':
        base_username = f"firebase-{firebase_uid[:8]}"

    username = base_username
    existing_user = get_user(db, username)
    if existing_user and (not current_user or existing_user.id != current_user.id):
        username = f"{base_username}-{firebase_uid[:8]}"

    return username


FIREBASE_PROVIDER_MAP = {
    'google.com': 'google',
    'github.com': 'github',
    'password': 'local',
}

def extract_firebase_provider(decoded_token: dict) -> str:
    """Extract the normalized provider name from a Firebase ID token's claims."""
    raw = (decoded_token.get('firebase') or {}).get('sign_in_provider', '')
    return FIREBASE_PROVIDER_MAP.get(raw, raw)


def provider_list(provider: str) -> set[str]:
    """Return normalized providers from a comma-separated provider string."""
    return {p.strip().lower() for p in (provider or '').split(',') if p.strip()}


def provider_matches(existing: str, provider: str) -> bool:
    """Check whether an account already belongs to the given provider."""
    providers = provider_list(existing)
    return provider.lower() in providers or (provider == 'local' and 'password' in providers)


def get_or_create_firebase_user(db, decoded_token, firebase_request: FirebaseTokenRequest):
    email = (decoded_token.get('email') or '').strip().lower()
    firebase_uid = decoded_token.get('uid')
    provider = extract_firebase_provider(decoded_token)

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase account has no email")

    display_name = firebase_request.display_name or decoded_token.get('name') or email.split('@')[0]
    photo_url = firebase_request.photo_url or decoded_token.get('picture')
    name_parts = display_name.split(' ', 1)
    firstname = name_parts[0] or 'Firebase'
    lastname = name_parts[1] if len(name_parts) > 1 else ''

    user = db.query(User).filter(User.email == email).first()
    if user:
        if firebase_uid and user.firebase_uid == firebase_uid and provider_matches(user.provider, provider):
            user.username = build_firebase_username(db, display_name, email, firebase_uid, user)
            user.firstname = firstname
            user.lastname = lastname
            if photo_url:
                user.image_url = photo_url
            db.commit()
            db.refresh(user)
            return user

        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="An account with this email already exists.")

    username = build_firebase_username(db, display_name, email, firebase_uid)

    user = User(
        username=username,
        hashed_password=get_hashed(os.urandom(32).hex()),
        firstname=firstname,
        lastname=lastname,
        email=email,
        role=UserRole.USER,
        beta_tester=False,
        activated=True,
        image_url=photo_url,
        firebase_uid=firebase_uid,
        provider=provider,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

async def get_current_user(token: str = Depends(oauth2_scheme), db: SessionLocal = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_access_token(token) 
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user


@app.post("/token")
async def login_for_access_token( login_request: LoginRequest,  db: SessionLocal = Depends(get_db)):
    
    logger.info(f"Request body: {login_request}")
    user = authenticate_user(db, login_request.username, login_request.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"user":user.username, "access_token": access_token, "token_type": "bearer"}


@app.post("/firebase-token")
async def login_with_firebase_token(firebase_request: FirebaseTokenRequest, db: SessionLocal = Depends(get_db)):
    try:
        decoded_token = verify_firebase_id_token(firebase_request.id_token)
    except RuntimeError as error:
        logger.error(f"Firebase auth is not configured: {error}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Firebase auth is not configured",
        ) from error
    except Exception as error:
        logger.exception("Firebase token verification failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    user = get_or_create_firebase_user(db, decoded_token, firebase_request)
    access_token = create_access_token(data={"sub": user.username})
    return {"user": user.username, "access_token": access_token, "token_type": "bearer"}


@app.get("/users/me")
async def read_users_me(token: str = Depends(oauth2_scheme), db: SessionLocal = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = verify_access_token(token) 
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user

@app.put("/users/me")
async def update_user_info(user_update: UpdateUserRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    # Fetch the current user from the database
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    # Update the user information if provided
    if user_update.firstname:
        db_user.firstname = user_update.firstname
    if user_update.lastname:
        db_user.lastname = user_update.lastname
    if user_update.username:
        db_user.username = user_update.username
    if user_update.email:
        db_user.email = user_update.email

    # Commit the changes to the database and refresh
    db.commit()
    db.refresh(db_user)

    return db_user

@app.put("/users/me/password")
async def update_user_password(user_password_update: UpdateUserPasswordRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    # Fetch the current user from the database
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    # Update the user information if provided
    if user_password_update.password:
        hashed_password = get_hashed(user_password_update.password)
        db_user.password = hashed_password

    # Commit the changes to the database and refresh
    db.commit()
    db.refresh(db_user)

    return db_user

@app.put("/users/{user_id}/beta_tester")
async def update_beta_tester_status(user_id: int, beta_tester_update: UpdateBetaTesterRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: UPDATE BETA TESTER STATUS")

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    db_user.beta_tester = beta_tester_update.beta_tester

    db.commit()
    db.refresh(db_user)

    return db_user

@app.put("/users/{user_id}/activated")
async def update_beta_tester_status(user_id: int, activated_update: UpdateActiavtedRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: UPDATE BETA TESTER STATUS")

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    db_user.activated = activated_update.activated

    db.commit()
    db.refresh(db_user)

    return db_user

@app.put("/users/{user_id}/role")
async def update_user_role(user_id: int, user_role_update: UpdateUserRoleRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: UPDATE USER ROLE")

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    db_user.role = user_role_update.role
    db.commit()
    db.refresh(db_user)

    return db_user

@app.post("/register/")
async def register_user(register_request: RegisterRequest, db: SessionLocal = Depends(get_db)):
    # Check if the user already exists
    print(register_request)
    db_user = get_user(db, register_request.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    email = register_request.email.strip().lower()
    email_user = db.query(User).filter(User.email == email).first()
    if email_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    # Create new user instance
    hashed_password = get_hashed(register_request.password)
    new_user = User(username=register_request.username,
                    hashed_password=hashed_password,
                    firstname=register_request.firstname,
                    lastname=register_request.lastname,
                    email=email
                    )

    # Add new user to the database
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError as error:
        db.rollback()
        if 'users_email_key' in str(error.orig):
            raise HTTPException(status_code=400, detail="An account with this email already exists.") from error
        raise

    return {"username": new_user.username,"email":new_user.email, "id": new_user.id}#, "errorMessage": message}
    
@app.get("/users/", response_model=List[UserResponse])
async def read_users(current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource: GET USERS")
    
    users = db.query(User).all()
    return users

def is_local_user(db_user: User) -> bool:
    providers = {
        provider.strip().lower()
        for provider in (db_user.provider or 'local').split(',')
        if provider.strip()
    } or {'local'}
    return not db_user.firebase_uid and providers.issubset({'local', 'password'})


@app.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: SessionLocal = Depends(get_db),
):
    """Delete a local-only DB user (admin only).

    Firebase Auth users are not deleted by the backend. Social-login users
    must be managed in Firebase and are rejected here to avoid orphaning the
    external identity.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: DELETE USER")
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    if not is_local_user(db_user):
        raise HTTPException(
            status_code=400,
            detail="Only local accounts can be deleted from the admin panel.",
        )

    db.delete(db_user)
    db.commit()
    return {"detail": "User deleted"}

@app.get("/projects/")
async def read_own_projects(current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    return db.query(Projects).filter(Projects.user_id == current_user.id).all()

@app.post("/projects/")
async def create_project(project: ProjectsCreate, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_project = Projects(name=project.name, description=project.description,project_type=project.project_type,code=project.code, user_id=current_user.id)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/projects/{project_id}")
async def read_project(project_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    project = db.query(Projects).filter(Projects.id == project_id, Projects.user_id == current_user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/projects/{project_id}")
async def delete_project(project_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_project = db.query(Projects).filter(Projects.id == project_id, Projects.user_id == current_user.id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(db_project)
    db.commit()
    return {"detail": "Project deleted"}

@app.put("/projects/{project_id}")
async def update_project(project_id: int, project_update: ProjectsCreate, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_project = db.query(Projects).filter(Projects.id == project_id, Projects.user_id == current_user.id).first()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    db_project.name = project_update.name
    db_project.description = project_update.description    
    db_project.code = project_update.code

    db.commit()
    db.refresh(db_project)
    return db_project


# Run the application
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
