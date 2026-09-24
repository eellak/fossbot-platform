"""store a generated preview image per editable local stage

Revision ID: 20260731_11
Revises: 20260731_10
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa


revision = "20260731_11"
down_revision = "20260731_10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("local_stages")}
    if "preview_image" not in columns:
        op.add_column("local_stages", sa.Column("preview_image", sa.LargeBinary(), nullable=True))
    if "preview_mime" not in columns:
        op.add_column("local_stages", sa.Column("preview_mime", sa.String(length=64), nullable=True))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("local_stages")}
    if "preview_mime" in columns:
        op.drop_column("local_stages", "preview_mime")
    if "preview_image" in columns:
        op.drop_column("local_stages", "preview_image")
