"""anonymous guest sessions and class-scoped guest participation

Revision ID: 20260731_12
Revises: 20260731_11
Create Date: 2026-07-31
"""
from alembic import op
import sqlalchemy as sa


revision = "20260731_12"
down_revision = "20260731_11"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    if "guest_sessions" not in tables:
        op.create_table(
            "guest_sessions",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("alias", sa.String(length=64), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("expires_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_guest_sessions_token_hash", "guest_sessions", ["token_hash"], unique=True)

    if "guest_instance_settings" not in tables:
        op.create_table(
            "guest_instance_settings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("beta_tester", sa.Boolean(), nullable=False),
            sa.Column("allowed_views", sa.JSON(), nullable=False),
            sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.CheckConstraint("id = 1", name="ck_guest_instance_settings_singleton"),
        )

    enrollment_columns = {column["name"] for column in inspector.get_columns("enrollments")}
    with op.batch_alter_table("enrollments") as batch:
        if "guest_session_id" not in enrollment_columns:
            batch.add_column(sa.Column("guest_session_id", sa.Integer(), nullable=True))
            batch.create_index("ix_enrollments_guest_session_id", ["guest_session_id"])
            batch.create_foreign_key(
                "fk_enrollments_guest_session_id", "guest_sessions", ["guest_session_id"], ["id"],
            )
        if "assignment_id" not in enrollment_columns:
            batch.add_column(sa.Column("assignment_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(
                "fk_enrollments_assignment_id", "course_assignments", ["assignment_id"], ["id"],
            )
    enrollment_uniques = {item["name"] for item in sa.inspect(op.get_bind()).get_unique_constraints("enrollments")}
    enrollment_checks = {item["name"] for item in sa.inspect(op.get_bind()).get_check_constraints("enrollments")}
    with op.batch_alter_table("enrollments") as batch:
        batch.alter_column("student_id", existing_type=sa.Integer(), nullable=True)
        if "uq_enrollments_guest_assignment" not in enrollment_uniques:
            batch.create_unique_constraint(
                "uq_enrollments_guest_assignment", ["guest_session_id", "assignment_id"],
            )
        if "ck_enrollments_owner" not in enrollment_checks:
            batch.create_check_constraint(
                "ck_enrollments_owner",
                "(student_id IS NOT NULL AND guest_session_id IS NULL AND assignment_id IS NULL) OR "
                "(student_id IS NULL AND guest_session_id IS NOT NULL AND assignment_id IS NOT NULL)",
            )

    membership_columns = {column["name"] for column in inspector.get_columns("class_memberships")}
    if "guest_session_id" not in membership_columns:
        with op.batch_alter_table("class_memberships", schema=None) as batch:
            batch.add_column(sa.Column("guest_session_id", sa.Integer(), nullable=True))
            batch.create_index("ix_class_memberships_guest_session_id", ["guest_session_id"])
            batch.create_foreign_key(
                "fk_class_memberships_guest_session_id", "guest_sessions", ["guest_session_id"], ["id"],
            )
    membership_uniques = {item["name"] for item in sa.inspect(op.get_bind()).get_unique_constraints("class_memberships")}
    membership_checks = {item["name"] for item in sa.inspect(op.get_bind()).get_check_constraints("class_memberships")}
    with op.batch_alter_table("class_memberships") as batch:
        batch.alter_column("student_id", existing_type=sa.Integer(), nullable=True)
        if "uq_class_membership_guest" not in membership_uniques:
            batch.create_unique_constraint(
                "uq_class_membership_guest", ["group_id", "guest_session_id"],
            )
        if "ck_class_memberships_owner" not in membership_checks:
            batch.create_check_constraint(
                "ck_class_memberships_owner",
                "(student_id IS NOT NULL AND guest_session_id IS NULL) OR "
                "(student_id IS NULL AND guest_session_id IS NOT NULL)",
            )


def downgrade() -> None:
    with op.batch_alter_table("class_memberships") as batch:
        batch.drop_constraint("ck_class_memberships_owner", type_="check")
        batch.drop_constraint("uq_class_membership_guest", type_="unique")
        batch.drop_index("ix_class_memberships_guest_session_id")
        batch.drop_column("guest_session_id")
        batch.alter_column("student_id", existing_type=sa.Integer(), nullable=False)

    with op.batch_alter_table("enrollments") as batch:
        batch.drop_constraint("ck_enrollments_owner", type_="check")
        batch.drop_constraint("uq_enrollments_guest_assignment", type_="unique")
        batch.drop_index("ix_enrollments_guest_session_id")
        batch.drop_column("assignment_id")
        batch.drop_column("guest_session_id")
        batch.alter_column("student_id", existing_type=sa.Integer(), nullable=False)

    op.drop_table("guest_instance_settings")
    op.drop_index("ix_guest_sessions_token_hash", table_name="guest_sessions")
    op.drop_table("guest_sessions")
