"""education system phase 4 lesson workspaces

Revision ID: 20260720_03
Revises: 20260720_02
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa


revision = "20260720_03"
down_revision = "20260720_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("lesson_workspaces")}
    if "revision" not in columns:
        op.add_column("lesson_workspaces", sa.Column("revision", sa.Integer(), nullable=False, server_default="1"))
    if "initialized_at" not in columns:
        op.add_column("lesson_workspaces", sa.Column("initialized_at", sa.DateTime(), nullable=True))
        op.execute("UPDATE lesson_workspaces SET initialized_at = COALESCE(created_at, CURRENT_TIMESTAMP)")
        with op.batch_alter_table("lesson_workspaces") as batch:
            batch.alter_column("initialized_at", nullable=False)


def downgrade() -> None:
    with op.batch_alter_table("lesson_workspaces") as batch:
        batch.drop_column("initialized_at")
        batch.drop_column("revision")
