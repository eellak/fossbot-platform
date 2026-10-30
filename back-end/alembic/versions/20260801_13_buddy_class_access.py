"""delegated Buddy provider access and student blocking

Revision ID: 20260801_13
Revises: 20260731_12
Create Date: 2026-08-01
"""
from alembic import op
import sqlalchemy as sa


revision = "20260801_13"
down_revision = "20260731_12"
branch_labels = None
depends_on = None


def upgrade() -> None:
    provider_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_provider_configs")}
    if "class_assignable" not in provider_columns:
        op.add_column(
            "ai_provider_configs",
            sa.Column("class_assignable", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    settings_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "students_blocked" not in settings_columns:
        op.add_column(
            "ai_instance_settings",
            sa.Column("students_blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    rule_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_policy_rules")}
    if "authority" not in rule_columns:
        op.add_column(
            "ai_policy_rules",
            sa.Column("authority", sa.String(length=24), nullable=False, server_default="admin"),
        )

    group_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("class_groups")}
    if "ai_blocked" not in group_columns:
        op.add_column(
            "class_groups",
            sa.Column("ai_blocked", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    group_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("class_groups")}
    if "ai_blocked" in group_columns:
        op.drop_column("class_groups", "ai_blocked")

    rule_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_policy_rules")}
    if "authority" in rule_columns:
        op.drop_column("ai_policy_rules", "authority")

    settings_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_instance_settings")}
    if "students_blocked" in settings_columns:
        op.drop_column("ai_instance_settings", "students_blocked")

    provider_columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("ai_provider_configs")}
    if "class_assignable" in provider_columns:
        op.drop_column("ai_provider_configs", "class_assignable")
