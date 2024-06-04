from models.models import UserRole, ProjectsCreate, LoginRequest, RegisterRequest, UpdateActiavtedRequest, UpdateUserRequest, UpdateUserPasswordRequest, UserResponse, SessionTokenRequest, UpdateUserRoleRequest, UpdateBetaTesterRequest, EmailVerificationRequest
from database.database import create_db_tables, User, Projects, Curriculum, Lesson, getSessionLocal
from utils.utils_jwt import create_access_token, verify_access_token
from fastapi import FastAPI, Depends, HTTPException, status
from utils.utils_hash import get_hashed, verify_hashed 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from fastapi import Query
from fastapi import Body
from typing import List
import logging
import uvicorn
import os

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
    create_admin_user()


def get_user(db, username: str):
    return db.query(User).filter(User.username == username).first()

def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_hashed(password, user.hashed_password):
        return False
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

    # Create new user instance
    hashed_password = get_hashed(register_request.password)
    new_user = User(username=register_request.username,
                    hashed_password=hashed_password,
                    firstname=register_request.firstname,
                    lastname=register_request.lastname,
                    email=register_request.email
                    )

    # Add new user to the database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"username": new_user.username,"email":new_user.email, "id": new_user.id}#, "errorMessage": message}
    
@app.get("/users/", response_model=List[UserResponse])
async def read_users(current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized to access this resource: GET USERS")
    
    users = db.query(User).all()
    return users

@app.delete("/users/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: SessionLocal = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized for this action: DELETE USER")
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found in database")

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
