import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from database.database import Base, User  # noqa: E402
from models.models import UserRole  # noqa: E402
from routers import courses  # noqa: E402


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture()
def users(db):
    tutor = User(
        username="teacher",
        firstname="Teach",
        lastname="Er",
        email="teacher@example.test",
        hashed_password="unused",
        role=UserRole.TUTOR,
        activated=True,
    )
    other_tutor = User(
        username="other",
        firstname="Other",
        lastname="Tutor",
        email="other@example.test",
        hashed_password="unused",
        role=UserRole.TUTOR,
        activated=True,
    )
    student = User(
        username="student",
        firstname="Stu",
        lastname="Dent",
        email="student@example.test",
        hashed_password="unused",
        role=UserRole.USER,
        activated=True,
    )
    admin = User(
        username="administrator",
        firstname="Admin",
        lastname="User",
        email="admin@example.test",
        hashed_password="unused",
        role=UserRole.ADMIN,
        activated=True,
    )
    db.add_all([tutor, other_tutor, student, admin])
    db.commit()
    return tutor, other_tutor, student, admin


@pytest.fixture()
def client_for(db):
    clients = []

    def build(user):
        app = FastAPI()
        app.include_router(courses.router)

        def override_db():
            yield db

        app.dependency_overrides[courses.get_db] = override_db
        app.dependency_overrides[courses.get_current_user] = lambda: user
        app.dependency_overrides[courses.optional_current_user] = lambda: user
        client = TestClient(app)
        clients.append(client)
        return client

    yield build
    for client in clients:
        client.close()
