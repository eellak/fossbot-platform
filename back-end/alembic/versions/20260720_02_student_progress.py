"""education system phase 3 student progress

Revision ID: 20260720_02
Revises: 20260718_01
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa


revision = "20260720_02"
down_revision = "20260718_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    enrollment_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("enrollments")}
    progress_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("lesson_progress")}
    if "release_updated_at" not in enrollment_columns:
        op.add_column("enrollments", sa.Column("release_updated_at", sa.DateTime()))
    if "completion_method" not in progress_columns:
        op.add_column("lesson_progress", sa.Column("completion_method", sa.String()))


def downgrade() -> None:
    with op.batch_alter_table("lesson_progress") as batch:
        batch.drop_column("completion_method")
    with op.batch_alter_table("enrollments") as batch:
        batch.drop_column("release_updated_at")
