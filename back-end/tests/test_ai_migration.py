from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from database.database import Base


BACKEND_DIR = Path(__file__).resolve().parents[1]
AI_TABLES = {"ai_provider_configs", "ai_instance_settings", "ai_policy_rules", "ai_usage_events"}


def config_for(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["url_configured"] = True
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    return config


def test_ai_foundation_upgrade_and_downgrade_on_sqlite(tmp_path):
    url = f"sqlite:///{tmp_path / 'ai-migration.db'}"
    config = config_for(url)
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    for table_name in ("ai_usage_events", "ai_policy_rules", "ai_instance_settings", "ai_provider_configs"):
        Base.metadata.tables[table_name].drop(engine)
    command.stamp(config, "20260731_07")
    command.upgrade(config, "head")
    inspector = inspect(engine)
    assert AI_TABLES.issubset(inspector.get_table_names())
    usage_columns = {column["name"] for column in inspector.get_columns("ai_usage_events")}
    forbidden = {"prompt", "response", "code", "blockly_xml", "lesson_content", "stage_content", "student_answer", "telemetry", "secret"}
    assert forbidden.isdisjoint(usage_columns)

    command.downgrade(config, "20260731_07")
    assert AI_TABLES.isdisjoint(inspect(engine).get_table_names())
