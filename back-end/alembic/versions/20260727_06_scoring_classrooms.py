"""education system phase 7 scoring and classrooms

Revision ID: 20260727_06
Revises: 20260727_05
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa


revision = "20260727_06"
down_revision = "20260727_05"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    attempt_columns = {column["name"] for column in inspector.get_columns("mission_attempts")}
    if "score_config_version" not in attempt_columns:
        op.add_column("mission_attempts", sa.Column("score_config_version", sa.Integer(), nullable=True))
    if "score_config_hash" not in attempt_columns:
        op.add_column("mission_attempts", sa.Column("score_config_hash", sa.String(), nullable=True))
    if "score_result" not in attempt_columns:
        op.add_column("mission_attempts", sa.Column("score_result", sa.JSON(), nullable=True))

    tables = set(inspector.get_table_names())
    if "class_groups" not in tables:
        op.create_table(
            "class_groups",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("teacher_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("join_code", sa.String(), nullable=False),
            sa.Column("leaderboards_enabled", sa.Boolean(), nullable=False),
            sa.Column("challenge_season", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint("status IN ('active', 'archived')", name="ck_class_groups_status"),
            sa.UniqueConstraint("join_code", name="uq_class_groups_join_code"),
        )
        op.create_index("ix_class_groups_join_code", "class_groups", ["join_code"], unique=True)

    if "class_memberships" not in tables:
        op.create_table(
            "class_memberships",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("class_groups.id"), nullable=False),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("display_alias", sa.String(), nullable=False),
            sa.Column("leaderboard_opt_in", sa.Boolean(), nullable=False),
            sa.Column("joined_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("removed_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("group_id", "student_id", name="uq_class_membership_student"),
        )

    if "course_assignments" not in tables:
        op.create_table(
            "course_assignments",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("group_id", sa.Integer(), sa.ForeignKey("class_groups.id"), nullable=False),
            sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
            sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
            sa.Column("update_policy", sa.String(), nullable=False),
            sa.Column("due_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint(
                "update_policy IN ('pinned', 'student_choice', 'latest')",
                name="ck_course_assignments_update_policy",
            ),
            sa.UniqueConstraint("group_id", "course_id", name="uq_course_assignment_group_course"),
        )

    if "class_challenges" not in tables:
        op.create_table(
            "class_challenges",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("assignment_id", sa.Integer(), sa.ForeignKey("course_assignments.id"), nullable=False),
            sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
            sa.Column("lesson_key", sa.String(), nullable=False),
            sa.Column("activity_key", sa.String(), nullable=False),
            sa.Column("enabled", sa.Boolean(), nullable=False),
            sa.Column("board_type", sa.String(), nullable=False),
            sa.Column("tie_tolerance", sa.Float(), nullable=False),
            sa.Column("season", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint(
                "board_type IN ('highest_score', 'fastest', 'fewest_movements', 'shortest_path', 'most_optional')",
                name="ck_class_challenges_board_type",
            ),
            sa.UniqueConstraint(
                "assignment_id", "release_id", "lesson_key", "activity_key", "season",
                name="uq_class_challenge_context",
            ),
        )


def downgrade() -> None:
    op.drop_table("class_challenges")
    op.drop_table("course_assignments")
    op.drop_table("class_memberships")
    op.drop_index("ix_class_groups_join_code", table_name="class_groups")
    op.drop_table("class_groups")
    op.drop_column("mission_attempts", "score_result")
    op.drop_column("mission_attempts", "score_config_hash")
    op.drop_column("mission_attempts", "score_config_version")
