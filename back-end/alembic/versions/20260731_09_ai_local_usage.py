"""add optional local AI usage reporting

Revision ID: 20260731_09
Revises: 20260731_08
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa


revision = "20260731_09"
down_revision = "20260731_08"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "report_local_usage" not in columns:
        op.add_column("ai_instance_settings", sa.Column("report_local_usage", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "report_local_usage" in columns:
        op.drop_column("ai_instance_settings", "report_local_usage")
