import os
import pytest
from alembic import command
from sqlalchemy import create_engine, inspect, text

from database.database import Base
from test_guest_migration import config_for


def test_bootstrap_upgrade_and_downgrade_preserve_project(tmp_path):
    url = f"sqlite:///{tmp_path / 'sharing-migration.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    config = config_for(url)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO projects (id, name, code, user_id) VALUES (100, 'Keep me', 'unchanged', 1)"))
    index = next(item for item in inspect(engine).get_indexes("projects") if item["name"] == "ix_projects_share_token")
    assert index["unique"]
    command.downgrade(config, "20260731_12")
    assert "share_token" not in {column["name"] for column in inspect(engine).get_columns("projects")}
    with engine.connect() as connection:
        assert connection.execute(text("SELECT code FROM projects WHERE id=100")).scalar() == "unchanged"
    command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT share_token FROM projects WHERE id=100")).scalar() is None
    engine.dispose()


@pytest.mark.skipif(not os.getenv("FOSSBOT_PROJECT_SHARING_TEST_DATABASE"), reason="Disposable PostgreSQL database not configured")
def test_postgres_sharing_upgrade_downgrade():
    from sqlalchemy.engine import make_url
    url = os.environ["FOSSBOT_PROJECT_SHARING_TEST_DATABASE"]
    assert make_url(url).database.endswith("_project_sharing_test")
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    config = config_for(url)
    command.upgrade(config, "head")
    command.downgrade(config, "20260731_12")
    command.upgrade(config, "head")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id, username, firstname, lastname, email, hashed_password, role, beta_tester, activated, provider, access_revoked) VALUES (901, 'share-test', 'T', 'S', 'share@test.invalid', 'unused', 'USER', false, true, 'local', false)"))
        connection.execute(text("INSERT INTO projects (id, name, code, user_id) VALUES (901, 'Preserve', 'same', 901), (902, 'Also null', '', 901)"))
        assert connection.execute(text("SELECT count(*) FROM projects WHERE share_token IS NULL")).scalar() == 2
        connection.execute(text("UPDATE projects SET share_token = :token WHERE id=901"), {"token": "x" * 43})
    assert next(item for item in inspect(engine).get_indexes("projects") if item["name"] == "ix_projects_share_token")["unique"]
    command.downgrade(config, "20260731_12")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT code FROM projects WHERE id=901")).scalar() == "same"
    engine.dispose()


def test_existing_column_missing_index_is_repaired(tmp_path):
    url = f"sqlite:///{tmp_path / 'sharing-index.db'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP INDEX ix_projects_share_token"))
    config = config_for(url)
    command.stamp(config, "20260731_12")
    command.upgrade(config, "head")
    assert "ix_projects_share_token" in {item["name"] for item in inspect(engine).get_indexes("projects")}
    engine.dispose()
