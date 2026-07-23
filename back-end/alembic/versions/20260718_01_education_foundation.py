"""education system phase 1 foundation

Revision ID: 20260718_01
Revises:
Create Date: 2026-07-18
"""
import datetime

from alembic import op
import sqlalchemy as sa


revision = "20260718_01"
down_revision = None
branch_labels = None
depends_on = None


def table_names() -> set[str]:
    return set(sa.inspect(op.get_bind()).get_table_names())


def column_names(table: str) -> set[str]:
    return {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table)}


def create_courses() -> None:
    op.create_table(
        "courses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("learning_objectives", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("visibility", sa.String(), nullable=False),
        sa.Column("cover_image_url", sa.String()),
        sa.Column("age_range", sa.String()),
        sa.Column("difficulty", sa.String()),
        sa.Column("estimated_duration_minutes", sa.Integer()),
        sa.Column("prerequisites", sa.Text()),
        sa.Column("tags", sa.JSON()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'published', 'archived')", name="ck_courses_status"),
        sa.CheckConstraint("visibility IN ('public', 'unlisted')", name="ck_courses_visibility"),
    )


def copy_legacy_courses() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    legacy = sa.Table("curriculums", metadata, autoload_with=bind)
    courses = sa.Table("courses", metadata, autoload_with=bind)
    existing = set(bind.execute(sa.select(courses.c.id)).scalars())
    now = datetime.datetime.utcnow()
    for row in bind.execute(sa.select(legacy)).mappings():
        if row["id"] in existing:
            continue
        bind.execute(
            courses.insert().values(
                id=row["id"],
                title=row["name"],
                description=row.get("description") or "",
                author_id=row["user_id"],
                learning_objectives=["Imported from legacy curriculum"],
                status="draft",
                visibility="public",
                cover_image_url=row.get("image_url"),
                created_at=now,
                updated_at=now,
            )
        )
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text("""
            SELECT setval(
                pg_get_serial_sequence('courses', 'id'),
                COALESCE((SELECT MAX(id) FROM courses), 1),
                EXISTS (SELECT 1 FROM courses)
            )
        """))


def migrate_lessons() -> None:
    if "lessons" not in table_names():
        op.create_table(
            "lessons",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("lesson_key", sa.String(), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("position", sa.Integer(), nullable=False),
            sa.Column("activities", sa.JSON(), nullable=False),
            sa.Column("completion_policy", sa.String(), nullable=False),
            sa.Column("start_mode", sa.String(), nullable=False),
            sa.Column("editor_type", sa.String(), nullable=False),
            sa.Column("starter_content", sa.JSON()),
            sa.Column("simulator_settings", sa.JSON()),
            sa.Column("archived", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("description", sa.String()),
            sa.Column("image_url", sa.String()),
            sa.Column("video_url", sa.String()),
            sa.Column("stage_source_type", sa.String()),
            sa.Column("stage_repo_owner", sa.String()),
            sa.Column("stage_repo_name", sa.String()),
            sa.Column("stage_repo_visibility", sa.String()),
            sa.Column("stage_marketplace_entry_path", sa.String()),
            sa.Column("stage_title", sa.String()),
            sa.Column("stage_url", sa.String()),
            sa.Column("stage_commit_sha", sa.String()),
            sa.UniqueConstraint("course_id", "lesson_key", name="uq_lessons_course_key"),
            sa.UniqueConstraint("course_id", "position", name="uq_lessons_course_position"),
            sa.CheckConstraint(
                "completion_policy IN ('self', 'activity', 'teacher_review', 'hybrid')",
                name="ck_lessons_completion_policy",
            ),
            sa.CheckConstraint(
                "start_mode IN ('fresh', 'inherit_previous_code')", name="ck_lessons_start_mode"
            ),
            sa.CheckConstraint(
                "editor_type IN ('none', 'python', 'blockly')", name="ck_lessons_editor_type"
            ),
        )
        return

    original = column_names("lessons")
    if "course_id" in original and "curriculum_id" not in original:
        return
    additions = {
        "lesson_key": sa.Column("lesson_key", sa.String()),
        "course_id": sa.Column("course_id", sa.Integer()),
        "position": sa.Column("position", sa.Integer()),
        "activities": sa.Column("activities", sa.JSON()),
        "completion_policy": sa.Column("completion_policy", sa.String()),
        "start_mode": sa.Column("start_mode", sa.String()),
        "editor_type": sa.Column("editor_type", sa.String()),
        "starter_content": sa.Column("starter_content", sa.JSON()),
        "simulator_settings": sa.Column("simulator_settings", sa.JSON()),
        "archived": sa.Column("archived", sa.Boolean()),
        "created_at": sa.Column("created_at", sa.DateTime()),
        "updated_at": sa.Column("updated_at", sa.DateTime()),
    }
    with op.batch_alter_table("lessons") as batch:
        for name, column in additions.items():
            if name not in original:
                batch.add_column(column)

    bind = op.get_bind()
    metadata = sa.MetaData()
    lessons = sa.Table("lessons", metadata, autoload_with=bind)
    now = datetime.datetime.utcnow()
    positions: dict[int, int] = {}
    for row in bind.execute(sa.select(lessons).order_by(lessons.c.curriculum_id, lessons.c.id)).mappings():
        course_id = row.get("course_id") or row.get("curriculum_id")
        positions[course_id] = positions.get(course_id, 0) + 1
        values = {
            "lesson_key": row.get("lesson_key") or f"legacy-{row['id']}",
            "course_id": course_id,
            "position": row.get("position") or positions[course_id],
            "activities": row.get("activities") or [
                {"key": f"legacy-content-{row['id']}", "type": "rich_text", "content": row.get("description") or ""}
            ],
            "completion_policy": row.get("completion_policy") or "self",
            "start_mode": row.get("start_mode") or "fresh",
            "editor_type": row.get("editor_type") or "none",
            "archived": bool(row.get("archived", False)),
            "created_at": row.get("created_at") or now,
            "updated_at": row.get("updated_at") or now,
        }
        bind.execute(lessons.update().where(lessons.c.id == row["id"]).values(**values))

    if "curriculum_id" in original:
        with op.batch_alter_table("lessons", recreate="always") as batch:
            batch.drop_column("curriculum_id")
            batch.alter_column("lesson_key", nullable=False)
            batch.alter_column("course_id", nullable=False)
            batch.alter_column("position", nullable=False)
            batch.alter_column("activities", nullable=False)
            batch.alter_column("completion_policy", nullable=False)
            batch.alter_column("start_mode", nullable=False)
            batch.alter_column("editor_type", nullable=False)
            batch.alter_column("archived", nullable=False)
            batch.alter_column("created_at", nullable=False)
            batch.alter_column("updated_at", nullable=False)
            batch.create_foreign_key("fk_lessons_course", "courses", ["course_id"], ["id"])
            batch.create_unique_constraint("uq_lessons_course_key", ["course_id", "lesson_key"])
            batch.create_unique_constraint("uq_lessons_course_position", ["course_id", "position"])
            batch.create_check_constraint(
                "ck_lessons_completion_policy",
                "completion_policy IN ('self', 'activity', 'teacher_review', 'hybrid')",
            )
            batch.create_check_constraint(
                "ck_lessons_start_mode", "start_mode IN ('fresh', 'inherit_previous_code')"
            )
            batch.create_check_constraint(
                "ck_lessons_editor_type", "editor_type IN ('none', 'python', 'blockly')"
            )


def create_release_and_progress_tables() -> None:
    existing = table_names()
    if "course_releases" not in existing:
        op.create_table(
            "course_releases",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False),
            sa.Column("schema_version", sa.Integer(), nullable=False),
            sa.Column("snapshot", sa.JSON(), nullable=False),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("published_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("course_id", "version", name="uq_course_releases_version"),
        )
    if "latest_published_release_id" not in column_names("courses"):
        with op.batch_alter_table("courses") as batch:
            batch.add_column(sa.Column("latest_published_release_id", sa.Integer()))
            batch.create_foreign_key(
                "fk_courses_latest_release", "course_releases", ["latest_published_release_id"], ["id"]
            )
    existing = table_names()
    if "enrollments" not in existing:
        op.create_table(
            "enrollments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("active_release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
            sa.Column("enrolled_at", sa.DateTime(), nullable=False),
            sa.Column("completed_at", sa.DateTime()),
            sa.UniqueConstraint("student_id", "course_id", name="uq_enrollments_student_course"),
        )
    if "lesson_progress" not in existing:
        op.create_table(
            "lesson_progress",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.id"), nullable=False),
            sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
            sa.Column("lesson_key", sa.String(), nullable=False),
            sa.Column("state", sa.String(), nullable=False),
            sa.Column("started_at", sa.DateTime()),
            sa.Column("completed_at", sa.DateTime()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("enrollment_id", "release_id", "lesson_key", name="uq_lesson_progress_release_lesson"),
            sa.CheckConstraint(
                "state IN ('not_started', 'in_progress', 'completed')", name="ck_lesson_progress_state"
            ),
        )
    if "lesson_workspaces" not in existing:
        op.create_table(
            "lesson_workspaces",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.id"), nullable=False),
            sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
            sa.Column("lesson_key", sa.String(), nullable=False),
            sa.Column("editor_type", sa.String(), nullable=False),
            sa.Column("saved_content", sa.JSON()),
            sa.Column("origin", sa.JSON()),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("enrollment_id", "release_id", "lesson_key", name="uq_lesson_workspaces_release_lesson"),
            sa.CheckConstraint(
                "editor_type IN ('none', 'python', 'blockly')", name="ck_lesson_workspaces_editor_type"
            ),
        )


def upgrade() -> None:
    existing = table_names()
    if "courses" not in existing:
        create_courses()
    if "curriculums" in existing:
        copy_legacy_courses()
    migrate_lessons()
    create_release_and_progress_tables()
    if "curriculums" in table_names():
        op.drop_table("curriculums")


def downgrade() -> None:
    op.create_table(
        "curriculums",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String()),
        sa.Column("image_url", sa.String()),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    bind = op.get_bind()
    metadata = sa.MetaData()
    courses = sa.Table("courses", metadata, autoload_with=bind)
    curriculums = sa.Table("curriculums", metadata, autoload_with=bind)
    for row in bind.execute(sa.select(courses)).mappings():
        bind.execute(curriculums.insert().values(
            id=row["id"], name=row["title"], description=row["description"], image_url=row["cover_image_url"], user_id=row["author_id"]
        ))
    with op.batch_alter_table("lessons", recreate="always") as batch:
        batch.add_column(sa.Column("curriculum_id", sa.Integer()))
    op.execute(sa.text("UPDATE lessons SET curriculum_id = course_id"))
    with op.batch_alter_table("lessons", recreate="always") as batch:
        batch.drop_column("course_id")
        for name in (
            "lesson_key", "position", "activities", "completion_policy", "start_mode", "editor_type",
            "starter_content", "simulator_settings", "archived", "created_at", "updated_at",
        ):
            batch.drop_column(name)
        batch.alter_column("curriculum_id", nullable=False)
        batch.create_foreign_key("fk_lessons_curriculum", "curriculums", ["curriculum_id"], ["id"])
    op.drop_table("lesson_workspaces")
    op.drop_table("lesson_progress")
    op.drop_table("enrollments")
    with op.batch_alter_table("courses") as batch:
        batch.drop_constraint("fk_courses_latest_release", type_="foreignkey")
        batch.drop_column("latest_published_release_id")
    op.drop_table("course_releases")
    op.drop_table("courses")
