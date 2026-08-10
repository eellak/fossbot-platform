"""add AI assistant policy foundation

Revision ID: 20260731_08
Revises: 20260731_07
Create Date: 2026-07-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260731_08"
down_revision = "20260731_07"
branch_labels = None
depends_on = None


JSON_DOCUMENT = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def upgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    if "ai_provider_configs" not in tables:
        op.create_table(
        "ai_provider_configs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("provider_type", sa.String(length=32), nullable=False),
        sa.Column("runtime", sa.String(length=24), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("model", sa.String(length=160), nullable=False),
        sa.Column("base_url", sa.String(length=500)),
        sa.Column("encrypted_secret", sa.Text()),
        sa.Column("settings", JSON_DOCUMENT, nullable=False),
        sa.Column("request_limit", sa.Integer()),
        sa.Column("token_limit", sa.Integer()),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("provider_type IN ('openai', 'google', 'openai_compatible', 'webllm')", name="ck_ai_provider_configs_type"),
        sa.CheckConstraint("runtime IN ('hosted', 'browser', 'user_local')", name="ck_ai_provider_configs_runtime"),
        sa.UniqueConstraint("name"),
        )
        op.create_index("ix_ai_provider_configs_id", "ai_provider_configs", ["id"])

    if "ai_instance_settings" not in tables:
        op.create_table(
        "ai_instance_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("default_provider_id", sa.Integer(), sa.ForeignKey("ai_provider_configs.id")),
        sa.Column("request_limit", sa.Integer()),
        sa.Column("token_limit", sa.Integer()),
        sa.Column("registry_version", sa.String(length=32), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_ai_instance_settings_singleton"),
        )

    if "ai_policy_rules" not in tables:
        op.create_table(
        "ai_policy_rules",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scope_type", sa.String(length=24), nullable=False),
        sa.Column("scope_key", sa.String(length=80), nullable=False),
        sa.Column("capability", sa.String(length=80), nullable=False),
        sa.Column("effect", sa.String(length=16), nullable=False),
        sa.Column("provider_ids", JSON_DOCUMENT),
        sa.Column("runtimes", JSON_DOCUMENT),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("scope_type IN ('instance', 'role', 'class_group', 'user')", name="ck_ai_policy_rules_scope"),
        sa.CheckConstraint("effect IN ('allow', 'deny')", name="ck_ai_policy_rules_effect"),
        sa.UniqueConstraint("scope_type", "scope_key", "capability", name="uq_ai_policy_scope_capability"),
        )
        op.create_index("ix_ai_policy_rules_id", "ai_policy_rules", ["id"])

    if "ai_usage_events" not in tables:
        op.create_table(
        "ai_usage_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("provider_id", sa.Integer(), sa.ForeignKey("ai_provider_configs.id")),
        sa.Column("capability", sa.String(length=80), nullable=False),
        sa.Column("provider_name", sa.String(length=120)),
        sa.Column("model", sa.String(length=160)),
        sa.Column("runtime", sa.String(length=24), nullable=False),
        sa.Column("request_id", sa.String(length=80), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime()),
        sa.Column("outcome", sa.String(length=40), nullable=False),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("policy_version", sa.String(length=32), nullable=False),
        sa.Column("prompt_version", sa.String(length=32)),
        sa.UniqueConstraint("request_id"),
        )
        op.create_index("ix_ai_usage_events_id", "ai_usage_events", ["id"])
        op.create_index("ix_ai_usage_events_user_id", "ai_usage_events", ["user_id"])


def downgrade() -> None:
    tables = set(sa.inspect(op.get_bind()).get_table_names())
    for table in ("ai_usage_events", "ai_policy_rules", "ai_instance_settings", "ai_provider_configs"):
        if table in tables:
            op.drop_table(table)
