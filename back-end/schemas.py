from pydantic import BaseModel
from typing import List
import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class requestdetails(BaseModel):
    email:str
    password:str
        
class TokenSchema(BaseModel):
    access_token: str
    refresh_token: str

class changepassword(BaseModel):
    email:str
    old_password:str
    new_password:str

class TokenCreate(BaseModel):
    user_id:str
    access_token:str
    refresh_token:str
    status:bool
    created_date:datetime.datetime

class ProjectBase(BaseModel):
    name: str
    description: str
    editor: str

class User(BaseModel):
    username: str
    email: str
    password: str
    projects: List[ProjectBase] = [] 

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(ProjectBase):
    pass