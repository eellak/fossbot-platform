from enum import Enum as PyEnum
from pydantic import BaseModel
from typing import Optional

class UserRole(PyEnum):
    ADMIN = 'admin'
    TUTOR = 'tutor'
    USER = 'user'

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    firstname: str
    lastname: str
    email: str

class UpdateUserRequest(BaseModel):
    firstname: str
    lastname: str
    username: str
    email: str

class UpdateUserPasswordRequest(BaseModel): 
    password: str

class ProjectsCreate(BaseModel):
    name: str
    description: str
    project_type: str    
    code: str

class SessionTokenRequest(BaseModel):
    session_token: str

class FirebaseTokenRequest(BaseModel):
    id_token: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    photo_url: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    firstname: str
    lastname: str
    email: str
    role: UserRole
    image_url: Optional[str]
    beta_tester: bool
    activated: bool
    firebase_uid: Optional[str]
    provider: str
    
    class Config:
        orm_mode = True

class UpdateUserRoleRequest(BaseModel):
    role: UserRole

class UpdateBetaTesterRequest(BaseModel):
    beta_tester: bool

class EmailVerificationRequest(BaseModel):
    email: str
    username: str

class UpdateActiavtedRequest(BaseModel):
    activated: bool