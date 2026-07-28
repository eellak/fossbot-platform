"""education system phase 6 mission attempts

Revision ID: 20260727_05
Revises: 20260725_04
Create Date: 2026-07-27
"""
from alembic import op
import sqlalchemy as sa


revision = "20260727_05"
down_revision = "20260725_04"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "mission_attempts" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "mission_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.id"), nullable=False),
        sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
        sa.Column("lesson_key", sa.String(), nullable=False),
        sa.Column("activity_key", sa.String(), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("client_attempt_id", sa.String(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("ended_at", sa.DateTime(), nullable=False),
        sa.Column("outcome", sa.String(), nullable=False),
        sa.Column("completion_reason", sa.String(), nullable=False),
        sa.Column("objective_results", sa.JSON(), nullable=False),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("simulator_revision", sa.String(), nullable=False),
        sa.Column("stage_revision", sa.String(), nullable=False),
        sa.Column("mission_definition_hash", sa.String(), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "outcome IN ('succeeded', 'failed', 'stopped', 'runtime_error')",
            name="ck_mission_attempt_outcome",
        ),
        sa.UniqueConstraint(
            "enrollment_id", "release_id", "lesson_key", "activity_key", "attempt_number",
            name="uq_mission_attempt_number",
        ),
        sa.UniqueConstraint(
            "enrollment_id", "release_id", "client_attempt_id",
            name="uq_mission_attempt_client_id",
        ),
    )


def downgrade() -> None:
    op.drop_table("mission_attempts")
