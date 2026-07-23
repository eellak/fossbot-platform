from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_legacy_curriculum_and_lesson_survive_upgrade(tmp_path):
    database_path = tmp_path / "legacy.db"
    url = f"sqlite:///{database_path}"
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username VARCHAR NOT NULL,
                firstname VARCHAR NOT NULL,
                lastname VARCHAR NOT NULL,
                email VARCHAR NOT NULL,
                hashed_password VARCHAR NOT NULL,
                role VARCHAR NOT NULL,
                beta_tester BOOLEAN NOT NULL,
                activated BOOLEAN NOT NULL,
                provider VARCHAR NOT NULL,
                access_revoked BOOLEAN NOT NULL
            )
        """))
        connection.execute(text("""
            CREATE TABLE curriculums (
                id INTEGER PRIMARY KEY,
                name VARCHAR NOT NULL,
                description VARCHAR,
                image_url VARCHAR,
                user_id INTEGER NOT NULL REFERENCES users(id)
            )
        """))
        connection.execute(text("""
            CREATE TABLE lessons (
                id INTEGER PRIMARY KEY,
                title VARCHAR NOT NULL,
                description VARCHAR,
                image_url VARCHAR,
                video_url VARCHAR,
                stage_source_type VARCHAR,
                stage_repo_owner VARCHAR,
                stage_repo_name VARCHAR,
                stage_repo_visibility VARCHAR,
                stage_marketplace_entry_path VARCHAR,
                stage_title VARCHAR,
                stage_url VARCHAR,
                stage_commit_sha VARCHAR,
                curriculum_id INTEGER NOT NULL REFERENCES curriculums(id)
            )
        """))
        connection.execute(text("""
            INSERT INTO users VALUES
            (7, 'legacy-teacher', 'Legacy', 'Teacher', 'legacy@example.test', 'unused', 'TUTOR', 0, 1, 'local', 0)
        """))
        connection.execute(text("""
            INSERT INTO curriculums VALUES
            (41, 'Legacy robotics', 'Preserve me', '/cover.png', 7)
        """))
        connection.execute(text("""
            INSERT INTO lessons VALUES
            (99, 'Legacy lesson', 'Old content', '/lesson.png', '/video.mp4',
             'marketplace', 'legacy', 'fossbot-maze', 'public',
             'stages/legacy/fossbot-maze.json', 'Maze',
             'https://example.test/stage.json', '0123456789abcdef', 41)
        """))

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["url_configured"] = True
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")

    inspector = inspect(engine)
    assert "curriculums" not in inspector.get_table_names()
    assert {"courses", "course_releases", "enrollments", "lesson_progress", "lesson_workspaces"}.issubset(
        inspector.get_table_names()
    )
    with engine.connect() as connection:
        course = connection.execute(text("SELECT * FROM courses WHERE id = 41")).mappings().one()
        lesson = connection.execute(text("SELECT * FROM lessons WHERE id = 99")).mappings().one()
    assert course["title"] == "Legacy robotics"
    assert course["author_id"] == 7
    assert course["cover_image_url"] == "/cover.png"
    assert lesson["course_id"] == 41
    assert lesson["lesson_key"] == "legacy-99"
    assert lesson["stage_source_type"] == "marketplace"
    assert lesson["stage_repo_owner"] == "legacy"
    assert lesson["stage_repo_name"] == "fossbot-maze"
    assert lesson["stage_marketplace_entry_path"] == "stages/legacy/fossbot-maze.json"
    assert lesson["stage_commit_sha"] == "0123456789abcdef"
