"""track local stage and marketplace storage

Revision ID: 20260731_07
Revises: 20260727_06
Create Date: 2026-07-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260731_07"
down_revision = "20260727_06"
branch_labels = None
depends_on = None


JSON_DOCUMENT = sa.JSON().with_variant(postgresql.JSONB(), "postgresql")


def _column_names(inspector: sa.Inspector, table: str) -> set[str]:
    return {column["name"] for column in inspector.get_columns(table)}


def _add_column_if_missing(inspector: sa.Inspector, table: str, column: sa.Column) -> None:
    if table in inspector.get_table_names() and column.name not in _column_names(inspector, table):
        op.add_column(table, column)


def _add_foreign_key_if_missing(
    inspector: sa.Inspector,
    table: str,
    column: str,
    referred_table: str,
    name: str,
) -> None:
    if inspector.bind.dialect.name == "sqlite":
        return
    foreign_keys = inspector.get_foreign_keys(table)
    if any(key.get("constrained_columns") == [column] for key in foreign_keys):
        return
    op.create_foreign_key(name, table, referred_table, [column], ["id"])


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    if "local_stages" not in tables:
        op.create_table(
            "local_stages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("slug", sa.String(length=100), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("visibility", sa.String(length=16), nullable=False),
            sa.Column("record", JSON_DOCUMENT, nullable=False),
            sa.Column("record_bytes", sa.Integer(), nullable=False),
            sa.Column("revision", sa.Integer(), nullable=False),
            sa.Column("checksum", sa.String(length=64), nullable=False),
            sa.Column("provenance", JSON_DOCUMENT, nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.UniqueConstraint("user_id", "slug", name="uq_local_stage_user_slug"),
        )
        op.create_index("ix_local_stages_user_id", "local_stages", ["user_id"])

    if "local_marketplace_submissions" not in tables:
        op.create_table(
            "local_marketplace_submissions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("stage_id", sa.Integer(), sa.ForeignKey("local_stages.id"), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("stage_revision", sa.Integer(), nullable=False),
            sa.Column("checksum", sa.String(length=64), nullable=False),
            sa.Column("slug_snapshot", sa.String(length=100), nullable=False),
            sa.Column("record_snapshot", JSON_DOCUMENT, nullable=False),
            sa.Column("record_bytes", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("tags", JSON_DOCUMENT, nullable=False),
            sa.Column("sharing_license", sa.String(length=32), nullable=False),
            sa.Column("provenance_snapshot", JSON_DOCUMENT, nullable=True),
            sa.Column("preview_image", sa.LargeBinary(), nullable=True),
            sa.Column("preview_mime", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=24), nullable=False),
            sa.Column("requested_at", sa.DateTime(), nullable=False),
            sa.Column("reviewed_at", sa.DateTime(), nullable=True),
            sa.Column("reviewed_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("review_reason", sa.Text(), nullable=True),
            sa.Column("unpublished_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_local_marketplace_submissions_stage_id", "local_marketplace_submissions", ["stage_id"])
        op.create_index("ix_local_marketplace_submissions_owner_user_id", "local_marketplace_submissions", ["owner_user_id"])

    if "local_marketplace_publications" not in tables:
        op.create_table(
            "local_marketplace_publications",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("stage_id", sa.Integer(), sa.ForeignKey("local_stages.id"), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("stage_revision", sa.Integer(), nullable=False),
            sa.Column("checksum", sa.String(length=64), nullable=False),
            sa.Column("record_snapshot", JSON_DOCUMENT, nullable=False),
            sa.Column("record_bytes", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("tags", JSON_DOCUMENT, nullable=False),
            sa.Column("sharing_license", sa.String(length=32), nullable=False),
            sa.Column("provenance_snapshot", JSON_DOCUMENT, nullable=True),
            sa.Column("preview_image", sa.LargeBinary(), nullable=True),
            sa.Column("preview_mime", sa.String(length=64), nullable=True),
            sa.Column("current_submission_id", sa.Integer(), sa.ForeignKey("local_marketplace_submissions.id"), nullable=True),
            sa.Column("active", sa.Boolean(), nullable=False),
            sa.Column("published_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.Column("unpublished_at", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("stage_id", name="uq_local_marketplace_stage"),
        )
        op.create_index("ix_local_marketplace_publications_stage_id", "local_marketplace_publications", ["stage_id"])
        op.create_index("ix_local_marketplace_publications_owner_user_id", "local_marketplace_publications", ["owner_user_id"])

    inspector = sa.inspect(op.get_bind())
    _add_column_if_missing(inspector, "projects", sa.Column("stage_local_id", sa.Integer(), nullable=True))
    _add_column_if_missing(inspector, "lessons", sa.Column("stage_local_id", sa.Integer(), nullable=True))

    inspector = sa.inspect(op.get_bind())
    _add_foreign_key_if_missing(
        inspector,
        "projects",
        "stage_local_id",
        "local_stages",
        "fk_projects_stage_local_id_local_stages",
    )
    _add_foreign_key_if_missing(
        inspector,
        "lessons",
        "stage_local_id",
        "local_stages",
        "fk_lessons_stage_local_id_local_stages",
    )

    for table in ("marketplace_reports", "marketplace_moderation_overrides", "marketplace_moderation_actions"):
        _add_column_if_missing(inspector, table, sa.Column("source_type", sa.String(), nullable=False, server_default="github"))
        _add_column_if_missing(inspector, table, sa.Column("local_publication_id", sa.Integer(), nullable=True))
    _add_column_if_missing(inspector, "marketplace_moderation_overrides", sa.Column("display_owner", sa.String(), nullable=True))
    _add_column_if_missing(inspector, "marketplace_moderation_overrides", sa.Column("display_name", sa.String(), nullable=True))

    _add_column_if_missing(inspector, "local_marketplace_publications", sa.Column("current_submission_id", sa.Integer(), nullable=True))
    _add_column_if_missing(inspector, "local_marketplace_publications", sa.Column("unpublished_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())

    for table in ("projects", "lessons"):
        if table in tables and "stage_local_id" in _column_names(inspector, table):
            with op.batch_alter_table(table) as batch_op:
                batch_op.drop_column("stage_local_id")

    moderation_columns = {
        "marketplace_reports": ("local_publication_id", "source_type"),
        "marketplace_moderation_overrides": ("display_name", "display_owner", "local_publication_id", "source_type"),
        "marketplace_moderation_actions": ("local_publication_id", "source_type"),
    }
    for table, columns in moderation_columns.items():
        if table not in tables:
            continue
        existing = _column_names(inspector, table)
        with op.batch_alter_table(table) as batch_op:
            for column in columns:
                if column in existing:
                    batch_op.drop_column(column)

    for table in ("local_marketplace_publications", "local_marketplace_submissions", "local_stages"):
        if table in tables:
            op.drop_table(table)
