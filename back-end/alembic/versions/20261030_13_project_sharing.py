"""Revocable live project links.

Revision ID: 20261030_13
Revises: 20260801_13
"""
from alembic import op
import sqlalchemy as sa

revision = "20261030_13"
down_revision = "20260801_13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "projects" not in inspector.get_table_names():
        return
    if "share_token" not in {column["name"] for column in inspector.get_columns("projects")}:
        op.add_column("projects", sa.Column("share_token", sa.String(43), nullable=True))
    if "ix_projects_share_token" not in {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("projects")}:
        op.create_index("ix_projects_share_token", "projects", ["share_token"], unique=True)


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "projects" not in inspector.get_table_names() or "share_token" not in {column["name"] for column in inspector.get_columns("projects")}:
        return
    with op.batch_alter_table("projects") as batch:
        batch.drop_index("ix_projects_share_token")
        batch.drop_column("share_token")
