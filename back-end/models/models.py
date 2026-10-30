from enum import Enum as PyEnum
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Literal, Optional
from pydantic import Field

class UserRole(PyEnum):
    ADMIN = 'admin'
    TUTOR = 'tutor'
    USER = 'user'

class GuestView(str, PyEnum):
    DASHBOARD = 'dashboard'
    PYTHON = 'python'
    BLOCKLY = 'blockly'
    INTERACTIVE = 'interactive'
    RC = 'rc'
    COURSES = 'courses'
    CLASSROOMS = 'classrooms'
    STAGES = 'stages'
    STAGE_BUILDER = 'stage_builder'


class GuestSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')

    beta_tester: bool = Field(default=False, strict=True)
    allowed_views: list[GuestView] = Field(
        default_factory=lambda: list(GuestView), max_length=len(GuestView),
    )
    ai_enabled: bool = Field(default=False, strict=True)
    ai_provider_ids: list[int] = Field(default_factory=list, max_length=64)

    @field_validator('allowed_views')
    @classmethod
    def unique_views(cls, views: list[GuestView]) -> list[GuestView]:
        if len(views) != len(set(views)):
            raise ValueError('Guest views must be unique')
        return views

    @field_validator('ai_provider_ids')
    @classmethod
    def unique_providers(cls, provider_ids: list[int]) -> list[int]:
        if len(provider_ids) != len(set(provider_ids)):
            raise ValueError('Guest AI providers must be unique')
        return provider_ids


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
    sourceType: Optional[str] = Field(default=None, pattern="^(default|local|github|marketplace)$")
    localStageId: Optional[int] = Field(default=None, ge=1)
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

class ProjectSharingState(BaseModel):
    shareToken: Optional[str] = None


class SharedProjectData(BaseModel):
    name: str
    description: str
    project_type: Literal['python', 'blockly']
    code: str
    stageReference: Optional[LectureStageReference] = None
    stageFallback: bool = False


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
    marketplace_roles: list[str] = Field(default_factory=list)
    
    class Config:
        orm_mode = True

class UpdateUserRoleRequest(BaseModel):
    role: UserRole

class UpdateMarketplaceRolesRequest(BaseModel):
    roles: list[str] = Field(default_factory=list)

class UpdateBetaTesterRequest(BaseModel):
    beta_tester: bool

class UpdateAccessRevokedRequest(BaseModel):
    access_revoked: bool

class EmailVerificationRequest(BaseModel):
    email: str
    username: str

class UpdateActiavtedRequest(BaseModel):
    activated: bool
