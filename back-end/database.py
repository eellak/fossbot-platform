from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Access environment variables
DATABASE_URL = os.getenv("DATABASE_URL")

# create a PostgreSQL engine instance
engine = create_engine(DATABASE_URL)

# create declarative base meta instance
Base = declarative_base()

# create session local class for session maker
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)