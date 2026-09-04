"""bound AI usage metadata retention

Revision ID: 20260731_10
Revises: 20260731_09
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa


revision = "20260731_10"
down_revision = "20260731_09"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "usage_retention_days" not in columns:
        op.add_column(
            "ai_instance_settings",
            sa.Column("usage_retention_days", sa.Integer(), nullable=False, server_default="30"),
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "usage_retention_days" in columns:
        op.drop_column("ai_instance_settings", "usage_retention_days")
