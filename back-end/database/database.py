from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    create_engine,
    inspect,
    text,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from models.models import UserRole
import datetime
import os
from pathlib import Path

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
    """Apply the additive auth schema required by this integration branch."""
    inspector = inspect(engine)
    table_columns = {t: {c['name'] for c in inspector.get_columns(t)} for t in inspector.get_table_names()}

    if 'users' in table_columns:
        cols = table_columns['users']
        with engine.begin() as conn:
            if 'firebase_uid' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR"))
            if 'provider' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN provider VARCHAR NOT NULL DEFAULT 'local'"))
            if 'access_revoked' not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN access_revoked BOOLEAN NOT NULL DEFAULT false"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_firebase_uid_unique "
                "ON users (firebase_uid) WHERE firebase_uid IS NOT NULL"
            ))

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

    if 'enrollments' in table_columns and 'release_updated_at' not in table_columns['enrollments']:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE enrollments ADD COLUMN release_updated_at TIMESTAMP"))
            conn.commit()

    if 'lesson_progress' in table_columns and 'completion_method' not in table_columns['lesson_progress']:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE lesson_progress ADD COLUMN completion_method VARCHAR"))
            conn.commit()

def create_db_tables():
    Base.metadata.create_all(bind=engine)


def run_tracked_migrations():
    """Apply tracked Alembic revisions after create_all bootstraps a new database."""
    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.attributes["url_configured"] = True
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
    command.upgrade(config, "head")


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
    firebase_uid = Column(String, unique=True, nullable=True)  # Firebase Auth UID for social-login users
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


class MarketplaceRoleAssignment(Base):
    __tablename__ = "marketplace_role_assignments"
    __table_args__ = (UniqueConstraint('user_id', 'role', name='uq_marketplace_role_assignment'),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    role = Column(String, nullable=False)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    user = relationship("User")


class MarketplaceReport(Base):
    __tablename__ = "marketplace_reports"

    id = Column(Integer, primary_key=True, index=True)
    repo_owner = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    commit_sha = Column(String, nullable=False)
    category = Column(String, nullable=False)
    explanation = Column(Text, nullable=False)
    reporter_contact = Column(String)
    reporter_user_id = Column(Integer, ForeignKey('users.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime)
    reporter = relationship("User")


class MarketplaceModerationOverride(Base):
    __tablename__ = "marketplace_moderation_overrides"
    __table_args__ = (UniqueConstraint('repo_owner', 'repo_name', name='uq_marketplace_moderation_override'),)

    id = Column(Integer, primary_key=True, index=True)
    repo_owner = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    state = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    reason = Column(Text, nullable=False)
    moderator_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    moderator = relationship("User")


class MarketplaceModerationAction(Base):
    __tablename__ = "marketplace_moderation_actions"

    id = Column(Integer, primary_key=True, index=True)
    repo_owner = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    action = Column(String, nullable=False)
    reason = Column(Text, nullable=False)
    moderator_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    report_id = Column(Integer, ForeignKey('marketplace_reports.id'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    moderator = relationship("User")
    report = relationship("MarketplaceReport")


class MarketplaceVerificationRequest(Base):
    __tablename__ = "marketplace_verification_requests"
    __table_args__ = (UniqueConstraint('repo_owner', 'repo_name', 'commit_sha', name='uq_marketplace_verification_request'),)

    id = Column(Integer, primary_key=True, index=True)
    repo_owner = Column(String, nullable=False)
    repo_name = Column(String, nullable=False)
    commit_sha = Column(String, nullable=False)
    status = Column(String, nullable=False, default="requested")
    requested_by_user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    requested_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    review_pr_number = Column(Integer)
    review_pr_url = Column(String)
    reviewed_at = Column(DateTime)
    requested_by = relationship("User")

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
    
class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'published', 'archived')", name="ck_courses_status"),
        CheckConstraint("visibility IN ('public', 'unlisted')", name="ck_courses_visibility"),
    )

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    author_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    learning_objectives = Column(JSON, nullable=False)
    status = Column(String, nullable=False, default="draft")
    visibility = Column(String, nullable=False, default="public")
    cover_image_url = Column(String)
    age_range = Column(String)
    difficulty = Column(String)
    estimated_duration_minutes = Column(Integer)
    prerequisites = Column(Text)
    tags = Column(JSON)
    latest_published_release_id = Column(Integer, ForeignKey('course_releases.id', use_alter=True, name='fk_courses_latest_release'))
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    author = relationship("User")
    lessons = relationship("Lesson", back_populates="course", order_by="Lesson.position")
    releases = relationship("CourseRelease", back_populates="course", foreign_keys="CourseRelease.course_id")

class Lesson(Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint('course_id', 'lesson_key', name='uq_lessons_course_key'),
        UniqueConstraint('course_id', 'position', name='uq_lessons_course_position'),
        CheckConstraint("completion_policy IN ('self', 'activity', 'teacher_review', 'hybrid')", name="ck_lessons_completion_policy"),
        CheckConstraint("start_mode IN ('fresh', 'inherit_previous_code')", name="ck_lessons_start_mode"),
        CheckConstraint("editor_type IN ('none', 'python', 'blockly')", name="ck_lessons_editor_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_key = Column(String, nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    title = Column(String, nullable=False)
    position = Column(Integer, nullable=False)
    activities = Column(JSON, nullable=False)
    completion_policy = Column(String, nullable=False, default="self")
    start_mode = Column(String, nullable=False, default="fresh")
    editor_type = Column(String, nullable=False, default="none")
    starter_content = Column(JSON)
    simulator_settings = Column(JSON)
    archived = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    # Retained while deprecated lecture clients migrate to structured activities.
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
    course = relationship("Course", back_populates="lessons")


class CourseRelease(Base):
    __tablename__ = "course_releases"
    __table_args__ = (UniqueConstraint('course_id', 'version', name='uq_course_releases_version'),)

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    version = Column(Integer, nullable=False)
    schema_version = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    created_by_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    published_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    course = relationship("Course", back_populates="releases", foreign_keys=[course_id])
    created_by = relationship("User")


class Enrollment(Base):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint('student_id', 'course_id', name='uq_enrollments_student_course'),)

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    active_release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    enrolled_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime)
    release_updated_at = Column(DateTime)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"
    __table_args__ = (
        UniqueConstraint('enrollment_id', 'release_id', 'lesson_key', name='uq_lesson_progress_release_lesson'),
        CheckConstraint("state IN ('not_started', 'in_progress', 'completed')", name='ck_lesson_progress_state'),
    )

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey('enrollments.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    lesson_key = Column(String, nullable=False)
    state = Column(String, nullable=False, default='not_started')
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    completion_method = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class LessonWorkspace(Base):
    __tablename__ = "lesson_workspaces"
    __table_args__ = (
        UniqueConstraint('enrollment_id', 'release_id', 'lesson_key', name='uq_lesson_workspaces_release_lesson'),
        CheckConstraint("editor_type IN ('none', 'python', 'blockly')", name='ck_lesson_workspaces_editor_type'),
    )

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey('enrollments.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    lesson_key = Column(String, nullable=False)
    editor_type = Column(String, nullable=False)
    saved_content = Column(JSON)
    origin = Column(JSON)
    revision = Column(Integer, nullable=False, default=1)
    initialized_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class ActivityAnswer(Base):
    __tablename__ = "activity_answers"
    __table_args__ = (
        UniqueConstraint(
            'enrollment_id', 'release_id', 'lesson_key', 'activity_key',
            name='uq_activity_answers_release_activity',
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey('enrollments.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    lesson_key = Column(String, nullable=False)
    activity_key = Column(String, nullable=False)
    submitted_value = Column(JSON)
    correctness = Column(Boolean)
    satisfied = Column(Boolean, nullable=False, default=False)
    attempt_count = Column(Integer, nullable=False, default=0)
    last_submission_id = Column(String, nullable=False)
    sensor_summary = Column(JSON)
    first_submitted_at = Column(DateTime, nullable=False)
    last_submitted_at = Column(DateTime, nullable=False)
    satisfied_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class MissionAttempt(Base):
    __tablename__ = "mission_attempts"
    __table_args__ = (
        UniqueConstraint(
            'enrollment_id', 'release_id', 'lesson_key', 'activity_key', 'attempt_number',
            name='uq_mission_attempt_number',
        ),
        UniqueConstraint(
            'enrollment_id', 'release_id', 'client_attempt_id',
            name='uq_mission_attempt_client_id',
        ),
        CheckConstraint(
            "outcome IN ('succeeded', 'failed', 'stopped', 'runtime_error')",
            name='ck_mission_attempt_outcome',
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    enrollment_id = Column(Integer, ForeignKey('enrollments.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    lesson_key = Column(String, nullable=False)
    activity_key = Column(String, nullable=False)
    attempt_number = Column(Integer, nullable=False)
    client_attempt_id = Column(String, nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=False)
    outcome = Column(String, nullable=False)
    completion_reason = Column(String, nullable=False)
    objective_results = Column(JSON, nullable=False)
    metrics = Column(JSON, nullable=False)
    simulator_revision = Column(String, nullable=False)
    stage_revision = Column(String, nullable=False)
    mission_definition_hash = Column(String, nullable=False)
    schema_version = Column(Integer, nullable=False)
    score_config_version = Column(Integer)
    score_config_hash = Column(String)
    score_result = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)


class ClassGroup(Base):
    __tablename__ = "class_groups"
    __table_args__ = (
        CheckConstraint("status IN ('active', 'archived')", name="ck_class_groups_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, nullable=False, default="active")
    join_code = Column(String, nullable=False, unique=True, index=True)
    leaderboards_enabled = Column(Boolean, nullable=False, default=False)
    challenge_season = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class ClassMembership(Base):
    __tablename__ = "class_memberships"
    __table_args__ = (
        UniqueConstraint('group_id', 'student_id', name='uq_class_membership_student'),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('class_groups.id'), nullable=False)
    student_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    display_alias = Column(String, nullable=False)
    leaderboard_opt_in = Column(Boolean, nullable=False, default=False)
    joined_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    removed_at = Column(DateTime)


class CourseAssignment(Base):
    __tablename__ = "course_assignments"
    __table_args__ = (
        UniqueConstraint('group_id', 'course_id', name='uq_course_assignment_group_course'),
        CheckConstraint(
            "update_policy IN ('pinned', 'student_choice', 'latest')",
            name="ck_course_assignments_update_policy",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey('class_groups.id'), nullable=False)
    course_id = Column(Integer, ForeignKey('courses.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    update_policy = Column(String, nullable=False, default="student_choice")
    due_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


class ClassChallenge(Base):
    __tablename__ = "class_challenges"
    __table_args__ = (
        UniqueConstraint(
            'assignment_id', 'release_id', 'lesson_key', 'activity_key', 'season',
            name='uq_class_challenge_context',
        ),
        CheckConstraint(
            "board_type IN ('highest_score', 'fastest', 'fewest_movements', 'shortest_path', 'most_optional')",
            name="ck_class_challenges_board_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey('course_assignments.id'), nullable=False)
    release_id = Column(Integer, ForeignKey('course_releases.id'), nullable=False)
    lesson_key = Column(String, nullable=False)
    activity_key = Column(String, nullable=False)
    enabled = Column(Boolean, nullable=False, default=False)
    board_type = Column(String, nullable=False, default="highest_score")
    tie_tolerance = Column(Float, nullable=False, default=0)
    season = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)


# Import compatibility for code that has not yet adopted canonical product naming.
Curriculum = Course
