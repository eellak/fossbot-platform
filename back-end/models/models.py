from enum import Enum as PyEnum
from pydantic import BaseModel
from typing import Optional, List

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
    current_password: str
    new_password: str

class ProjectsCreate(BaseModel):
    name: str
    description: str
    project_type: str    
    code: str

class SessionTokenRequest(BaseModel):
    session_token: str

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


class CurriculumBase(BaseModel):
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None


class CurriculumCreate(CurriculumBase):
    pass


class CurriculumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None


class LessonBase(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None


class LessonCreate(LessonBase):
    pass


class LessonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None


class LessonResponse(LessonBase):
    id: int

    class Config:
        orm_mode = True


class CurriculumResponse(CurriculumBase):
    id: int
    lessons: List[LessonResponse] = []

    class Config:
        orm_mode = True