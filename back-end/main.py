import schemas
import models
import jwt
import os
from datetime import datetime 
from models import User,TokenTable, Project
from database import Base, engine, SessionLocal
from sqlalchemy import ForeignKey
from sqlalchemy.orm import Session
from fastapi import FastAPI, Depends, HTTPException,status
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import FileResponse
from auth_bearer import JWTBearer
from functools import wraps
from utils import create_access_token,create_refresh_token,verify_password,get_hashed_password, get_current_user
from dotenv import load_dotenv
from schemas import ProjectCreate, ProjectUpdate

# Load environment variables from .env file
load_dotenv()

ACCESS_TOKEN_EXPIRE_MINUTES = 30  # 30 minutes
REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days
ALGORITHM = "HS256"
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_REFRESH_SECRET_KEY = os.getenv("JWT_REFRESH_SECRET_KEY")

app = FastAPI()

Base.metadata.create_all(engine)

def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@app.post('/login' ,response_model=schemas.TokenSchema)
def login(request: schemas.requestdetails, db: Session = Depends(get_session)):
    user = db.query(User).filter(User.email == request.email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email")
    hashed_pass = user.password
    if not verify_password(request.password, hashed_pass):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password"
        )
    
    access=create_access_token(user.id)
    refresh = create_refresh_token(user.id)

    token_db = models.TokenTable(user_id=user.id,  access_toke=access,  refresh_toke=refresh, status=True)
    db.add(token_db)
    db.commit()
    db.refresh(token_db)
    return {
        "access_token": access,
        "refresh_token": refresh,
    }

@app.post("/register")
def register_user(user: schemas.UserCreate, session: Session = Depends(get_session)):
    existing_user = session.query(models.User).filter_by(email=user.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    encrypted_password =get_hashed_password(user.password)

    new_user = models.User(username=user.username, email=user.email, password=encrypted_password )

    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    return {"message":"user created successfully"}

@app.get('/getusers')
def getusers( dependencies=Depends(JWTBearer()),session: Session = Depends(get_session)):
    user = session.query(models.User).all()
    return user

@app.post('/change-password')
def change_password(request: schemas.changepassword, db: Session = Depends(get_session)):
    user = db.query(models.User).filter(models.User.email == request.email).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")
    
    if not verify_password(request.old_password, user.password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid old password")
    
    encrypted_password = get_hashed_password(request.new_password)
    user.password = encrypted_password
    db.commit()
    
    return {"message": "Password changed successfully"}

@app.post('/logout')
def logout(dependencies=Depends(JWTBearer()), db: Session = Depends(get_session)):
    token=dependencies
    payload = jwt.decode(token, JWT_SECRET_KEY, ALGORITHM)
    user_id = payload['sub']
    token_record = db.query(models.TokenTable).all()
    info=[]
    for record in token_record :
        print("record",record)
        if (datetime.utcnow() - record.created_date).days >1:
            info.append(record.user_id)
    if info:
        existing_token = db.query(models.TokenTable).where(TokenTable.user_id.in_(info)).delete()
        db.commit()
        
    existing_token = db.query(models.TokenTable).filter(models.TokenTable.user_id == user_id, models.TokenTable.access_toke==token).first()
    if existing_token:
        existing_token.status=False
        db.add(existing_token)
        db.commit()
        db.refresh(existing_token)
    return {"message":"Logout Successfully"} 

def token_required(func):
    @wraps(func)
    def wrapper(dependencies=Depends(JWTBearer()), session: Session = Depends(get_session)):
        payload = jwt.decode(dependencies, JWT_SECRET_KEY, ALGORITHM)
        user_id = payload['sub']
        data = session.query(models.TokenTable).filter_by(user_id=user_id, access_toke=dependencies, status=True).first()
        if data:
            return func(dependencies, session)
        else:
            return {'msg': "Token blocked"}
    return wrapper

@app.post("/projects")
def create_project(
    project: schemas.ProjectCreate,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    existing_project = session.query(Project).filter_by(name=project.name).first()
    if existing_project:
        raise HTTPException(status_code=400, detail="Project already exists")

    new_project = models.Project(
        name=project.name, description=project.description, editor=project.editor, user_id=current_user.id
    )

    session.add(new_project)
    session.commit()
    session.refresh(new_project)

    return {"message": "Project created successfully"}

@app.put("/projects/{project_id}")
def update_project(project_id: int, project: ProjectUpdate, session: Session = Depends(get_session)):
    existing_project = session.query(models.Project).filter_by(id=project_id).first()
    if not existing_project:
        raise HTTPException(status_code=404, detail="Project not found")

    for key, value in project.dict(exclude_unset=True).items():
        setattr(existing_project, key, value)

    session.add(existing_project)
    session.commit()
    session.refresh(existing_project)

    return {"message": "Project updated successfully"}

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    existing_project = session.query(models.Project).filter_by(id=project_id).first()
    if not existing_project:
        raise HTTPException(status_code=404, detail="Project not found")

    session.delete(existing_project)
    session.commit()

    return {"message": "Project deleted successfully"}

@app.get("/projects/{project_id}/download")
def download_project_code(project_id: int, session: Session = Depends(get_session)):
    project = session.query(models.Project).filter_by(id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return FileResponse(project.code_path, filename=f"{project.name}_code.zip")

@app.get("/projects/all")
def get_all_projects(session: Session = Depends(get_session)):
    projects = session.query(Project).all()
    return projects