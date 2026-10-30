"""guest buddy toggle, per-provider allowlist and guest usage rows

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
    inspector = sa.inspect(op.get_bind())
    guest_columns = {column["name"] for column in inspector.get_columns("guest_instance_settings")}
    with op.batch_alter_table("guest_instance_settings") as batch:
        if "ai_enabled" not in guest_columns:
            batch.add_column(sa.Column("ai_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
        if "ai_provider_ids" not in guest_columns:
            batch.add_column(sa.Column("ai_provider_ids", sa.JSON(), nullable=False, server_default="[]"))

    usage_columns = {column["name"] for column in inspector.get_columns("ai_usage_events")}
    with op.batch_alter_table("ai_usage_events") as batch:
        if "guest_session_id" not in usage_columns:
            batch.add_column(sa.Column("guest_session_id", sa.Integer(), nullable=True))
            batch.create_index("ix_ai_usage_events_guest_session_id", ["guest_session_id"])
            batch.create_foreign_key(
                "fk_ai_usage_events_guest_session_id", "guest_sessions", ["guest_session_id"], ["id"],
            )
        # Guest usage has no account row; the account columns stay untouched.
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Usage rows without an account cannot satisfy the restored NOT NULL column.
    op.execute("DELETE FROM ai_usage_events WHERE guest_session_id IS NOT NULL")
    with op.batch_alter_table("ai_usage_events") as batch:
        batch.drop_index("ix_ai_usage_events_guest_session_id")
        batch.drop_column("guest_session_id")
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)

    with op.batch_alter_table("guest_instance_settings") as batch:
        batch.drop_column("ai_provider_ids")
        batch.drop_column("ai_enabled")
