from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# replace with your own database url
DATABASE_URL = "postgresql://postgres:root@localhost:5432/db"

# create a PostgreSQL engine instance
engine = create_engine(DATABASE_URL)

# create declarative base meta instance
Base = declarative_base()

# create session local class for session maker
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)