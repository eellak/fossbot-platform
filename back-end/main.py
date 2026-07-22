import json
import logging
import os
import re
import time
import urllib.request
from typing import Any, List, Optional

import uvicorn
from database.database import (
    Curriculum,
    Lesson,
    MarketplaceRoleAssignment,
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
    LessonCreate,
    LessonUpdate,
    LoginRequest,
    ProjectsCreate,
    RegisterRequest,
    SessionTokenRequest,
    UpdateAccessRevokedRequest,
    UpdateActiavtedRequest,
    UpdateBetaTesterRequest,
    UpdateUserPasswordRequest,
    UpdateUserRequest,
    UpdateUserRoleRequest,
    UpdateMarketplaceRolesRequest,
    UserResponse,
    UserRole,
)
from sqlalchemy.exc import IntegrityError, OperationalError
from routers.stage_sources import (
    FOSSBOT_REPO_PREFIX,
    github_raw_base_url,
    github_stage_error,
    require_connection,
    router as stage_sources_router,
    stage_error,
    stage_repo_list_item,
)
from routers.marketplace import cached_public_marketplace_index, router as marketplace_router
from utils.github_app_auth import create_github_app_jwt
from utils.marketplace_schema import marketplace_entry_path
from utils.source_providers import get_provider
from utils.source_providers.github_app import GitHubApiError
from utils.utils_hash import get_hashed, verify_hashed
from utils.utils_jwt import create_access_token, verify_access_token

logger = logging.getLogger("uvicorn")
SessionLocal = getSessionLocal()

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
app.include_router(stage_sources_router)
app.include_router(marketplace_router)

# Security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


REVOKED_ACCESS_MESSAGE = "Your access to the platform has been revoked."
MARKETPLACE_ROLES = {"verifier", "moderator"}


def user_payload(db: SessionLocal, user: User) -> dict[str, Any]:
    roles = [assignment.role for assignment in db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.user_id == user.id).all()]
    return {
        "id": user.id,
        "username": user.username,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "email": user.email,
        "role": user.role,
        "image_url": user.image_url,
        "beta_tester": user.beta_tester,
        "activated": user.activated,
        "firebase_uid": user.firebase_uid,
        "provider": user.provider,
        "access_revoked": user.access_revoked,
        "marketplace_roles": sorted(roles),
    }
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

def initialize_database(max_attempts: int = 30, delay_seconds: float = 1.0):
    for attempt in range(1, max_attempts + 1):
        try:
            create_db_tables()
            migrate_schema()
            create_admin_user()
            return
        except OperationalError as error:
            if attempt == max_attempts:
                raise
            logger.warning("Database is not ready yet (%s/%s): %s", attempt, max_attempts, error)
            time.sleep(delay_seconds)


@app.on_event("startup")
def on_startup():
    initialize_database()


def get_user(db, username: str):
    return db.query(User).filter(User.username == username).first()

def provider_allows_local_login(provider: str) -> bool:
    providers = {p.strip().lower() for p in (provider or '').split(',')}
    return 'local' in providers


def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if user.access_revoked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=REVOKED_ACCESS_MESSAGE,
            headers={"WWW-Authenticate": "Bearer"},
        )
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


def merge_provider(existing: str, provider: str) -> str:
    """Add a provider to the user's provider list without dropping existing providers."""
    providers = provider_list(existing)
    providers.add(provider.lower())
    return ','.join(sorted(providers))


def merge_firebase_provider(existing: str, provider: str) -> str:
    """Add a Firebase provider and remove local/password once the account is Firebase-linked."""
    providers = provider_list(existing)
    providers.discard('local')
    providers.discard('password')
    providers.add(provider.lower())
    return ','.join(sorted(providers))


def provider_is_local_only(provider: str) -> bool:
    """Return whether the provider value represents a local/password-only account."""
    providers = provider_list(provider or 'local') or {'local'}
    return providers.issubset({'local', 'password'})


def can_link_local_to_firebase_provider(user: User, provider: str, email_verified: bool) -> bool:
    """Allow trusted social providers to claim an existing local account by email."""
    return (
        email_verified
        and provider in {'google', 'github'}
        and not user.firebase_uid
        and provider_is_local_only(user.provider)
    )


def link_local_user_to_firebase_provider(db, user: User, firebase_uid: str, provider: str, photo_url):
    user.firebase_uid = firebase_uid
    user.provider = merge_firebase_provider(user.provider, provider)
    user.hashed_password = get_hashed(os.urandom(32).hex())
    if photo_url:
        user.image_url = photo_url
    db.commit()
    db.refresh(user)
    return user_payload(db, user)


def update_firebase_user_metadata(db, user: User, display_name: str, email: str, firebase_uid: str, provider: str, photo_url):
    user.username = build_firebase_username(db, display_name, email, firebase_uid, user)
    name_parts = display_name.split(' ', 1)
    user.firstname = name_parts[0] or user.firstname or 'Firebase'
    user.lastname = name_parts[1] if len(name_parts) > 1 else user.lastname or ''
    user.provider = merge_firebase_provider(user.provider, provider)
    if photo_url:
        user.image_url = photo_url
    db.commit()
    db.refresh(user)
    return user


def get_or_create_firebase_user(db, decoded_token, firebase_request: FirebaseTokenRequest):
    email = (decoded_token.get('email') or '').strip().lower()
    firebase_uid = decoded_token.get('uid')
    provider = extract_firebase_provider(decoded_token)
    email_verified = decoded_token.get('email_verified') is True

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase account has no email")

    display_name = firebase_request.display_name or decoded_token.get('name') or email.split('@')[0]
    photo_url = firebase_request.photo_url or decoded_token.get('picture')
    name_parts = display_name.split(' ', 1)
    firstname = name_parts[0] or 'Firebase'
    lastname = name_parts[1] if len(name_parts) > 1 else ''

    if not firebase_uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase account has no UID")

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if user:
        if user.access_revoked:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REVOKED_ACCESS_MESSAGE)
        return update_firebase_user_metadata(db, user, display_name, email, firebase_uid, provider, photo_url)

    user = db.query(User).filter(User.email == email).first()
    if user:
        if user.access_revoked:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REVOKED_ACCESS_MESSAGE)

        if user.firebase_uid == firebase_uid:
            return update_firebase_user_metadata(db, user, display_name, email, firebase_uid, provider, photo_url)

        if user.firebase_uid and user.firebase_uid != firebase_uid:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This email already belongs to another Firebase account. Sign in with the existing provider and link this provider first.",
            )

        if can_link_local_to_firebase_provider(user, provider, email_verified):
            return link_local_user_to_firebase_provider(db, user, firebase_uid, provider, photo_url)

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
    if user.access_revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REVOKED_ACCESS_MESSAGE)
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
    if user.access_revoked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=REVOKED_ACCESS_MESSAGE)
    return user_payload(db, user)

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
    if db_user.role == UserRole.ADMIN:
        db_user.access_revoked = False

    db.commit()
    db.refresh(db_user)

    return db_user


@app.put("/users/{user_id}/marketplace-roles")
async def update_marketplace_roles(
    user_id: int,
    role_update: UpdateMarketplaceRolesRequest,
    current_user: User = Depends(get_current_user),
    db: SessionLocal = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to manage marketplace roles")
    requested = set(role_update.roles)
    if not requested.issubset(MARKETPLACE_ROLES):
        raise HTTPException(status_code=400, detail="Marketplace roles must be verifier and/or moderator")
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")
    db.query(MarketplaceRoleAssignment).filter(MarketplaceRoleAssignment.user_id == user_id).delete()
    db.add_all([MarketplaceRoleAssignment(user_id=user_id, role=role) for role in requested])
    db.commit()
    return user_payload(db, db_user)

@app.put("/users/{user_id}/access_revoked")
async def update_access_revoked_status(user_id: int, access_revoked_update: UpdateAccessRevokedRequest, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: UPDATE ACCESS REVOKED STATUS")

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

    if db_user.role == UserRole.ADMIN and access_revoked_update.access_revoked:
        raise HTTPException(status_code=400, detail="Admins cannot have access revoked")

    db_user.access_revoked = access_revoked_update.access_revoked

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
    
    return [user_payload(db, user) for user in db.query(User).all()]

def is_local_user(db_user: User) -> bool:
    return not db_user.firebase_uid and provider_is_local_only(db_user.provider)


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
    projects = db.query(Projects).filter(Projects.user_id == current_user.id).all()
    return [project_payload(project) for project in projects]

@app.post("/projects/")
async def create_project(project: ProjectsCreate, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_project = Projects(name=project.name, description=project.description,project_type=project.project_type,code=project.code, user_id=current_user.id)
    set_project_stage_reference(db_project, normalize_stage_reference(project.stageReference, current_user, db))
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return project_payload(db_project)

@app.get("/projects/{project_id}")
async def read_project(project_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    project = db.query(Projects).filter(Projects.id == project_id, Projects.user_id == current_user.id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_payload(project)

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
    if stage_reference_was_provided(project_update):
        set_project_stage_reference(db_project, normalize_stage_reference(project_update.stageReference, current_user, db))

    db.commit()
    db.refresh(db_project)
    return project_payload(db_project)


def clear_project_stage_reference(project: Projects) -> None:
    project.stage_source_type = None
    project.stage_repo_owner = None
    project.stage_repo_name = None
    project.stage_repo_visibility = None
    project.stage_marketplace_entry_path = None
    project.stage_title = None
    project.stage_url = None
    project.stage_commit_sha = None


def set_project_stage_reference(project: Projects, reference: Optional[dict[str, Any]]) -> None:
    clear_project_stage_reference(project)
    if not reference:
        return
    project.stage_source_type = reference.get("sourceType")
    project.stage_repo_owner = reference.get("repoOwner")
    project.stage_repo_name = reference.get("repoName")
    project.stage_repo_visibility = reference.get("visibility")
    project.stage_marketplace_entry_path = reference.get("marketplaceEntryPath")
    project.stage_title = reference.get("title")
    project.stage_url = reference.get("url")
    project.stage_commit_sha = reference.get("commitSha")


def stage_reference_payload(source: Any) -> Optional[dict[str, Any]]:
    if not source.stage_source_type:
        return None
    return {
        "sourceType": source.stage_source_type,
        "repoOwner": source.stage_repo_owner,
        "repoName": source.stage_repo_name,
        "visibility": source.stage_repo_visibility,
        "marketplaceEntryPath": source.stage_marketplace_entry_path,
        "title": source.stage_title,
        "url": source.stage_url,
        "commitSha": source.stage_commit_sha,
    }


def project_payload(project: Projects) -> dict[str, Any]:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "project_type": project.project_type,
        "date_created": project.date_created,
        "code": project.code,
        "stage_source_type": project.stage_source_type,
        "stage_repo_owner": project.stage_repo_owner,
        "stage_repo_name": project.stage_repo_name,
        "stage_repo_visibility": project.stage_repo_visibility,
        "stage_marketplace_entry_path": project.stage_marketplace_entry_path,
        "stage_title": project.stage_title,
        "stage_url": project.stage_url,
        "stage_commit_sha": project.stage_commit_sha,
        "stageReference": stage_reference_payload(project),
    }


def user_curriculum_or_404(db: SessionLocal, current_user: User, curriculum_id: int) -> Curriculum:
    curriculum = db.query(Curriculum).filter(Curriculum.id == curriculum_id, Curriculum.user_id == current_user.id).first()
    if curriculum is None:
        raise HTTPException(status_code=404, detail="Curriculum not found")
    return curriculum


def user_lesson_or_404(db: SessionLocal, current_user: User, lesson_id: int) -> Lesson:
    lesson = db.query(Lesson).join(Curriculum).filter(Lesson.id == lesson_id, Curriculum.user_id == current_user.id).first()
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return lesson


def stage_reference_was_provided(payload: Any) -> bool:
    fields = getattr(payload, "model_fields_set", getattr(payload, "__fields_set__", set()))
    return "stageReference" in fields


def clear_lesson_stage_reference(lesson: Lesson) -> None:
    lesson.stage_source_type = None
    lesson.stage_repo_owner = None
    lesson.stage_repo_name = None
    lesson.stage_repo_visibility = None
    lesson.stage_marketplace_entry_path = None
    lesson.stage_title = None
    lesson.stage_url = None
    lesson.stage_commit_sha = None


def published_marketplace_entry(owner: Optional[str], repo: Optional[str], entry_path: Optional[str]) -> dict[str, Any]:
    payload = cached_public_marketplace_index()
    stages = payload.get("stages") or []
    normalized_entry_path = entry_path
    if not normalized_entry_path and owner and repo:
        normalized_entry_path = marketplace_entry_path(owner, repo)
    for entry in stages:
        candidate_path = marketplace_entry_path(entry.get("repoOwner") or "", entry.get("repoName") or "")
        if normalized_entry_path and candidate_path == normalized_entry_path:
            return entry
        if owner and repo and entry.get("repoOwner") == owner and entry.get("repoName") == repo:
            return entry
    raise stage_error(404, "marketplace_stage_not_found", "Choose a stage that is already published in the marketplace.")


def installed_user_stage_reference(current_user: User, db: SessionLocal, owner: str, repo_name: str) -> dict[str, Any]:
    if not repo_name.startswith(FOSSBOT_REPO_PREFIX):
        raise stage_error(403, "repo_not_allowed", "Lecture stages must use fossbot-* repositories.")
    provider = get_provider("github_app")
    try:
        connection, user_token = require_connection(db, current_user)
        repos = provider.list_installation_repositories(user_token, connection.installation_id)
        repo = next(
            (
                item for item in repos
                if item.get("name") == repo_name and (item.get("owner") or {}).get("login", "").lower() == owner.lower()
            ),
            None,
        )
        if not repo:
            raise stage_error(404, "repo_not_allowed", "Choose one of your installed FOSSBot GitHub stage repositories.")
        installation_token = provider.create_installation_token(create_github_app_jwt(), connection.installation_id, repo.get("id"))
        stage_item = stage_repo_list_item(provider, installation_token, repo)
    except GitHubApiError as error:
        raise github_stage_error(error) from error
    if not stage_item:
        raise stage_error(400, "validation_failed", "That repository is not a valid FOSSBot stage repository.")
    return stage_item


def normalize_stage_reference(reference: Any, current_user: User, db: SessionLocal) -> Optional[dict[str, Any]]:
    if reference is None:
        return None
    source_type = reference.sourceType
    if source_type == "default":
        return {
            "sourceType": "default",
            "repoOwner": None,
            "repoName": None,
            "visibility": None,
            "marketplaceEntryPath": None,
            "title": reference.title,
            "url": reference.url,
            "commitSha": None,
        }
    if source_type == "github":
        if not reference.repoOwner or not reference.repoName:
            raise stage_error(400, "validation_failed", "GitHub stage references need repoOwner and repoName.")
        stage = installed_user_stage_reference(current_user, db, reference.repoOwner, reference.repoName)
        return {
            "sourceType": "github",
            "repoOwner": stage["repoOwner"],
            "repoName": stage["repoName"],
            "visibility": stage.get("visibility") or ("private" if stage.get("private") else "public"),
            "marketplaceEntryPath": None,
            "title": stage.get("title") or stage["repoName"],
            "url": reference.url or stage.get("repoUrl"),
            "commitSha": None,
        }
    if source_type == "marketplace":
        entry = published_marketplace_entry(reference.repoOwner, reference.repoName, reference.marketplaceEntryPath)
        return {
            "sourceType": "marketplace",
            "repoOwner": entry["repoOwner"],
            "repoName": entry["repoName"],
            "visibility": "public",
            "marketplaceEntryPath": marketplace_entry_path(entry["repoOwner"], entry["repoName"]),
            "title": entry.get("title") or entry["repoName"],
            "url": f"{github_raw_base_url(entry['repoOwner'], entry['repoName'], entry['commitSha'])}/stage.json",
            "commitSha": entry.get("commitSha"),
        }
    raise stage_error(400, "validation_failed", "stageReference.sourceType must be default, github, or marketplace.")


def set_lesson_stage_reference(lesson: Lesson, reference: Optional[dict[str, Any]]) -> None:
    clear_lesson_stage_reference(lesson)
    if not reference:
        return
    lesson.stage_source_type = reference.get("sourceType")
    lesson.stage_repo_owner = reference.get("repoOwner")
    lesson.stage_repo_name = reference.get("repoName")
    lesson.stage_repo_visibility = reference.get("visibility")
    lesson.stage_marketplace_entry_path = reference.get("marketplaceEntryPath")
    lesson.stage_title = reference.get("title")
    lesson.stage_url = reference.get("url")
    lesson.stage_commit_sha = reference.get("commitSha")


def lesson_payload(lesson: Lesson) -> dict[str, Any]:
    stage_reference = None
    if lesson.stage_source_type:
        stage_reference = stage_reference_payload(lesson)
    return {
        "id": lesson.id,
        "title": lesson.title,
        "description": lesson.description,
        "image_url": lesson.image_url,
        "video_url": lesson.video_url,
        "curriculum_id": lesson.curriculum_id,
        "stage_source_type": lesson.stage_source_type,
        "stage_repo_owner": lesson.stage_repo_owner,
        "stage_repo_name": lesson.stage_repo_name,
        "stage_repo_visibility": lesson.stage_repo_visibility,
        "stage_marketplace_entry_path": lesson.stage_marketplace_entry_path,
        "stage_title": lesson.stage_title,
        "stage_url": lesson.stage_url,
        "stage_commit_sha": lesson.stage_commit_sha,
        "stageReference": stage_reference,
    }


@app.get("/curriculums/{curriculum_id}/lessons")
async def read_curriculum_lessons(curriculum_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    user_curriculum_or_404(db, current_user, curriculum_id)
    lessons = db.query(Lesson).filter(Lesson.curriculum_id == curriculum_id).all()
    return [lesson_payload(lesson) for lesson in lessons]


@app.post("/lessons/")
@app.post("/lectures/")
async def create_lesson(lesson: LessonCreate, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    user_curriculum_or_404(db, current_user, lesson.curriculum_id)
    db_lesson = Lesson(
        title=lesson.title,
        description=lesson.description,
        image_url=lesson.image_url,
        video_url=lesson.video_url,
        curriculum_id=lesson.curriculum_id,
    )
    set_lesson_stage_reference(db_lesson, normalize_stage_reference(lesson.stageReference, current_user, db))
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    return lesson_payload(db_lesson)


@app.get("/lessons/{lesson_id}")
@app.get("/lectures/{lesson_id}")
async def read_lesson(lesson_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    return lesson_payload(user_lesson_or_404(db, current_user, lesson_id))


@app.put("/lessons/{lesson_id}")
@app.put("/lectures/{lesson_id}")
async def update_lesson(lesson_id: int, lesson_update: LessonUpdate, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_lesson = user_lesson_or_404(db, current_user, lesson_id)
    db_lesson.title = lesson_update.title
    db_lesson.description = lesson_update.description
    db_lesson.image_url = lesson_update.image_url
    db_lesson.video_url = lesson_update.video_url
    if stage_reference_was_provided(lesson_update):
        set_lesson_stage_reference(db_lesson, normalize_stage_reference(lesson_update.stageReference, current_user, db))
    db.commit()
    db.refresh(db_lesson)
    return lesson_payload(db_lesson)


@app.delete("/lessons/{lesson_id}")
@app.delete("/lectures/{lesson_id}")
async def delete_lesson(lesson_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    db_lesson = user_lesson_or_404(db, current_user, lesson_id)
    db.delete(db_lesson)
    db.commit()
    return {"detail": "Lesson deleted"}


# Run the application
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="debug")
