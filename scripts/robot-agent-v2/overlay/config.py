import os


class Config:
    DOCKER = True
    BASE_DIR = os.getenv("FOSSBOT_APP_DIR", "/opt/fossbot/app/blockly_server")
    APP_DIR = BASE_DIR
    DATA_DIR = os.getenv("FOSSBOT_DATA_DIR", "/var/lib/fossbot")
    PROJECT_DIR = os.path.join(DATA_DIR, "projects")
    ADMIN_PARAMS = os.path.join(DATA_DIR, "admin_parameters.yaml")
    ROBOT_MODE = "physical"
    SQLITE_DIR = os.path.join(DATA_DIR, "robot_database.db")
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{SQLITE_DIR}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    LOCALE = os.getenv("LOCALE", "en")
    BABEL_DEFAULT_LOCALE = LOCALE
    HOST = os.getenv("HOST", "0.0.0.0")
    PORT = int(os.getenv("PORT", "8081"))
    BROWSER_HOST = os.getenv("BROWSER_HOST", "127.0.0.1")
    DEBUG = False
    AUTOSTART_BROWSER = False
