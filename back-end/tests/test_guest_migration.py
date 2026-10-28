from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

from database.database import Base


BACKEND_DIR = Path(__file__).resolve().parents[1]
GUEST_TABLES = {"guest_sessions", "guest_instance_settings"}


def config_for(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["url_configured"] = True
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def test_fresh_database_upgrades_twice_without_error(tmp_path):
    url = f"sqlite:///{tmp_path / 'fresh.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    config = config_for(url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")

    inspector = inspect(engine)
    assert GUEST_TABLES.issubset(inspector.get_table_names())
    assert {"guest_session_id", "assignment_id"}.issubset(
        {column["name"] for column in inspector.get_columns("enrollments")}
    )
    assert "guest_session_id" in {column["name"] for column in inspector.get_columns("class_memberships")}


def test_existing_account_rows_survive_upgrade(tmp_path):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    for table in ("guest_sessions", "guest_instance_settings"):
        Base.metadata.tables[table].drop(engine)
    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO class_groups (id, teacher_id, name, status, join_code, leaderboards_enabled, challenge_season, created_at, updated_at) "
            "VALUES (1, 1, 'Class', 'active', 'ABCD1234', 0, 1, '2026-01-01', '2026-01-01')"
        ))
        connection.execute(text(
            "INSERT INTO class_memberships (id, group_id, student_id, display_alias, leaderboard_opt_in, joined_at, updated_at) "
            "VALUES (1, 1, 42, 'Learner-AA', 1, '2026-01-01', '2026-01-01')"
        ))
    command.stamp(config_for(url), "20260731_11")
    command.upgrade(config_for(url), "head")

    with engine.connect() as connection:
        membership = connection.execute(text("SELECT * FROM class_memberships WHERE id = 1")).mappings().one()
    assert membership["student_id"] == 42
    assert membership["guest_session_id"] is None
    assert membership["display_alias"] == "Learner-AA"


def test_owner_xor_and_guest_uniqueness_are_enforced(tmp_path):
    url = f"sqlite:///{tmp_path / 'constraints.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    command.upgrade(config_for(url), "head")

    with engine.begin() as connection:
        connection.execute(text(
            "INSERT INTO guest_sessions (id, alias, token_hash, created_at, expires_at) "
            "VALUES (1, 'calm_otter', 'hash-1', '2026-01-01', '2026-02-01')"
        ))
        connection.execute(text(
            "INSERT INTO class_groups (id, teacher_id, name, status, join_code, leaderboards_enabled, challenge_season, created_at, updated_at) "
            "VALUES (1, 1, 'Class', 'active', 'ABCD1234', 0, 1, '2026-01-01', '2026-01-01')"
        ))

    membership_sql = (
        "INSERT INTO class_memberships (group_id, student_id, guest_session_id, display_alias, leaderboard_opt_in, joined_at, updated_at) "
        "VALUES (1, :student, :guest, 'calm_otter', 0, '2026-01-01', '2026-01-01')"
    )
    with engine.begin() as connection:
        connection.execute(text(membership_sql), {"student": None, "guest": 1})
    with engine.connect() as connection:
        try:
            connection.execute(text(membership_sql), {"student": None, "guest": 1})
        except IntegrityError:
            connection.rollback()
        else:
            raise AssertionError("duplicate guest membership should be rejected")
        try:
            connection.execute(text(membership_sql), {"student": 42, "guest": None})
            connection.execute(text(membership_sql), {"student": 42, "guest": 1})
        except IntegrityError:
            connection.rollback()
        else:
            raise AssertionError("account and guest ownership must be exclusive")


def test_downgrade_is_safe_when_no_guests_exist(tmp_path):
    url = f"sqlite:///{tmp_path / 'downgrade.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    command.upgrade(config_for(url), "head")
    command.downgrade(config_for(url), "20260731_11")

    inspector = inspect(engine)
    assert GUEST_TABLES.isdisjoint(inspector.get_table_names())
    assert "guest_session_id" not in {column["name"] for column in inspector.get_columns("enrollments")}
    assert "guest_session_id" not in {column["name"] for column in inspector.get_columns("class_memberships")}
    assert "assignment_id" not in {column["name"] for column in inspector.get_columns("enrollments")}
