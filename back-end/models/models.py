from enum import Enum as PyEnum
from pydantic import BaseModel
from typing import Optional
from pydantic import Field

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

class LectureStageReference(BaseModel):
    sourceType: Optional[str] = Field(default=None, pattern="^(default|github|marketplace)$")
    repoOwner: Optional[str] = None
    repoName: Optional[str] = None
    marketplaceEntryPath: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None
    visibility: Optional[str] = None
    commitSha: Optional[str] = None

class ProjectsCreate(BaseModel):
    name: str
    description: str
    project_type: str    
    code: str
    stageReference: Optional[LectureStageReference] = None

class LessonCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    curriculum_id: int
    stageReference: Optional[LectureStageReference] = None

class LessonUpdate(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    stageReference: Optional[LectureStageReference] = None

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
    access_revoked: bool
    
    class Config:
        orm_mode = True

class UpdateUserRoleRequest(BaseModel):
    role: UserRole

class UpdateBetaTesterRequest(BaseModel):
    beta_tester: bool

class UpdateAccessRevokedRequest(BaseModel):
    access_revoked: bool

class EmailVerificationRequest(BaseModel):
    email: str
    username: str

class UpdateActiavtedRequest(BaseModel):
    activated: bool