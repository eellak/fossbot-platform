from fastapi import FastAPI, Depends, HTTPException, status,Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import create_engine, Column, Integer, String,ForeignKey,DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker,relationship
import datetime

from jose import JWTError, jwt

import uvicorn
from passlib.context import CryptContext
from fastapi import Body
from fastapi.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel
from typing import Optional
import os

logger = logging.getLogger("uvicorn")
# Constants for JWT

SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key')
ALGORITHM = "HS256"

# Database setup
DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    firstname: str
    lastname: str
    email: str

class ProjectsCreate(BaseModel):
    name: str
    description: str
    project_type: str    
    code: str

class SessionTokenRequest(BaseModel):
    session_token: str

# User model
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    firstname = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String , nullable=False)

class Projects(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name =  Column(String, nullable=False)
    description = Column(String)
    project_type = Column(String, default="python")
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    code = Column(String)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    user = relationship("User")


Base.metadata.create_all(bind=engine)

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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def get_user(db, username: str):
    return db.query(User).filter(User.username == username).first()

def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user or not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict):
    encoded_jwt = jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# def verify_access_token(data: str):
#     decoded_jwt = jwt.decode(data, SECRET_KEY, algorithm=ALGORITHM)
#     return decoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), db: SessionLocal = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
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

# @app.post("/token/verify")
# async def login_for_access_token(session_token_request: SessionTokenRequest):
    
#     logger.info(f"Request body: {session_token_request}")
#     decoded_token = verify_access_token(data=session_token_request.session_token)
#     print('decoded_token: ')
#     print(decoded_token)
    
#     credentials_exception = HTTPException(
#         status_code=status.HTTP_401_UNAUTHORIZED,
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )

#     try:
#         payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
#         username: str = payload.get("sub")
#         if username is None:
#             raise credentials_exception
#     except jwt.PyJWTError:
#         raise credentials_exception
    

#     return {"verified_token":}

@app.get("/users/me")
async def read_users_me(token: str = Depends(oauth2_scheme), db: SessionLocal = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    user = get_user(db, username=username)
    if user is None:
        raise credentials_exception
    return user

@app.post("/register")
async def register_user(register_request: RegisterRequest, db: SessionLocal = Depends(get_db)):
    # Check if the user already exists
    print(register_request)
    db_user = get_user(db, register_request.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")

    # Create new user instance
    hashed_password = get_password_hash(register_request.password)
    new_user = User(username=register_request.username,
                     hashed_password=hashed_password,
                     firstname=register_request.firstname,
                     lastname=register_request.lastname,
                     email=register_request.email)

    # Add new user to the database
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"username": new_user.username,"email":new_user.email, "id": new_user.id}

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
