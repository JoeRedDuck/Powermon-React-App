# database.py
from sqlalchemy import create_engine  # type: ignore
from sqlalchemy.orm import sessionmaker, declarative_base  # type: ignore
import os
from dotenv import load_dotenv  # type: ignore

load_dotenv()

# Prefer PostgreSQL when env vars are provided; otherwise fall back to SQLite memory
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASS = os.getenv('DB_PASS')
DB_HOST = os.getenv('DB_HOST')
DB_PORT = os.getenv('DB_PORT')

import sys

# If running under pytest, force SQLite in-memory for isolation
force_sqlite = any("pytest" in arg for arg in sys.argv)

if not force_sqlite and DB_NAME and DB_USER and DB_HOST:
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    engine = create_engine(DATABASE_URL)
else:
    # Use local in-memory SQLite for tests / dev when Postgres isn't configured
    DATABASE_URL = "sqlite:///:memory:"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# Create the session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our models
Base = declarative_base()

# Do not automatically create tables here to avoid circular imports; application
# startup or tests should call `Base.metadata.create_all(bind=engine)` when
# appropriate (e.g., for SQLite in-memory during tests).


def get_db():
    """Dependency for FastAPI to get a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
