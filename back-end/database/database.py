from sqlalchemy import create_engine, Column, Integer, String,ForeignKey,DateTime,Enum,Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from models.models import UserRole
import datetime
import os

# Database setup
DATABASE_URL = os.getenv('DATABASE', "sqlite:///./test.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()

# Function to create the database tables
def getSessionLocal():
    return SessionLocal

# Function to create the database tables
def create_db_tables():
    Base.metadata.create_all(bind=engine)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    firstname = Column(String, nullable=False)
    lastname = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    beta_tester = Column(Boolean, default=False, nullable=False)
    image_url = Column(String)  # Added field for user's profile image URL
    activated = Column(Boolean, default=False, nullable=False)  # New activated column

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
    
class Curriculum(Base):
    __tablename__ = "curriculums"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
    image_url = Column(String)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    user = relationship("User")
    lessons = relationship("Lesson", back_populates="curriculum")

class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    image_url = Column(String)
    video_url = Column(String)
    curriculum_id = Column(Integer, ForeignKey('curriculums.id'), nullable=False)
    curriculum = relationship("Curriculum", back_populates="lessons")