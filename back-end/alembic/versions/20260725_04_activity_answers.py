"""education system phase 5 activity answers

Revision ID: 20260725_04
Revises: 20260720_03
Create Date: 2026-07-25
"""
from alembic import op
import sqlalchemy as sa


revision = "20260725_04"
down_revision = "20260720_03"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "activity_answers" in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        "activity_answers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enrollment_id", sa.Integer(), sa.ForeignKey("enrollments.id"), nullable=False),
        sa.Column("release_id", sa.Integer(), sa.ForeignKey("course_releases.id"), nullable=False),
        sa.Column("lesson_key", sa.String(), nullable=False),
        sa.Column("activity_key", sa.String(), nullable=False),
        sa.Column("submitted_value", sa.JSON()),
        sa.Column("correctness", sa.Boolean()),
        sa.Column("satisfied", sa.Boolean(), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.Column("last_submission_id", sa.String(), nullable=False),
        sa.Column("sensor_summary", sa.JSON()),
        sa.Column("first_submitted_at", sa.DateTime(), nullable=False),
        sa.Column("last_submitted_at", sa.DateTime(), nullable=False),
        sa.Column("satisfied_at", sa.DateTime()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint(
            "enrollment_id", "release_id", "lesson_key", "activity_key",
            name="uq_activity_answers_release_activity",
        ),
    )


def downgrade() -> None:
    op.drop_table("activity_answers")
