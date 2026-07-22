from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Enum, Boolean, text, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy import inspect
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
def migrate_schema():
    """Apply schema migrations for columns that may not exist in existing databases."""
    inspector = inspect(engine)
    table_columns = {t: {c['name'] for c in inspector.get_columns(t)} for t in inspector.get_table_names()}

    if 'users' in table_columns:
        cols = table_columns['users']
        if 'firebase_uid' not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR"))
                conn.commit()
        if 'provider' not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN provider VARCHAR NOT NULL DEFAULT 'local'"))
                conn.commit()
        if 'access_revoked' not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN access_revoked BOOLEAN NOT NULL DEFAULT false"))
                conn.commit()

    if 'projects' in table_columns:
        project_cols = table_columns['projects']
        project_stage_columns = {
            'stage_source_type': 'VARCHAR',
            'stage_repo_owner': 'VARCHAR',
            'stage_repo_name': 'VARCHAR',
            'stage_repo_visibility': 'VARCHAR',
            'stage_marketplace_entry_path': 'VARCHAR',
            'stage_title': 'VARCHAR',
            'stage_url': 'VARCHAR',
            'stage_commit_sha': 'VARCHAR',
        }
        for column, column_type in project_stage_columns.items():
            if column not in project_cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE projects ADD COLUMN {column} {column_type}"))
                    conn.commit()

    if 'lessons' in table_columns:
        lesson_cols = table_columns['lessons']
        lesson_stage_columns = {
            'stage_source_type': 'VARCHAR',
            'stage_repo_owner': 'VARCHAR',
            'stage_repo_name': 'VARCHAR',
            'stage_repo_visibility': 'VARCHAR',
            'stage_marketplace_entry_path': 'VARCHAR',
            'stage_title': 'VARCHAR',
            'stage_url': 'VARCHAR',
            'stage_commit_sha': 'VARCHAR',
        }
        for column, column_type in lesson_stage_columns.items():
            if column not in lesson_cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE lessons ADD COLUMN {column} {column_type}"))
                    conn.commit()

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
    firebase_uid = Column(String, nullable=True)  # Firebase Auth UID for social-login users
    provider = Column(String, nullable=False, default='local')  # Auth provider(s): 'local', 'google', 'github', or comma-separated
    access_revoked = Column(Boolean, default=False, nullable=False)  # Blocks user login/access without deleting account

class SourceProviderConnection(Base):
    __tablename__ = "source_provider_connections"
    __table_args__ = (UniqueConstraint('user_id', 'provider_name', 'provider_account_login', name='uq_source_provider_connection'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    provider_name = Column(String, nullable=False)
    provider_account_login = Column(String, nullable=False)
    provider_account_id = Column(String)
    installation_id = Column(String)
    repository_selection = Column(String)
    user_token_encrypted = Column(String)
    user_token_expires_at = Column(DateTime)
    user_refresh_token_encrypted = Column(String)
    user_refresh_token_expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    user = relationship("User")

class Projects(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name =  Column(String, nullable=False)
    description = Column(String)
    project_type = Column(String, default="python")
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    code = Column(String)
    stage_source_type = Column(String)
    stage_repo_owner = Column(String)
    stage_repo_name = Column(String)
    stage_repo_visibility = Column(String)
    stage_marketplace_entry_path = Column(String)
    stage_title = Column(String)
    stage_url = Column(String)
    stage_commit_sha = Column(String)
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
    stage_source_type = Column(String)
    stage_repo_owner = Column(String)
    stage_repo_name = Column(String)
    stage_repo_visibility = Column(String)
    stage_marketplace_entry_path = Column(String)
    stage_title = Column(String)
    stage_url = Column(String)
    stage_commit_sha = Column(String)
    curriculum_id = Column(Integer, ForeignKey('curriculums.id'), nullable=False)
    curriculum = relationship("Curriculum", back_populates="lessons")