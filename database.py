# database.py
from sqlalchemy import create_engine  # type: ignore
from sqlalchemy.orm import sessionmaker, declarative_base  # type: ignore
import os
from dotenv import load_dotenv  # type: ignore

load_dotenv()

# Build connection string from your env vars
# Format: postgresql://user:password@host:port/dbname
DATABASE_URL = f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"

# Create the engine
engine = create_engine(DATABASE_URL)

# Create the session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our models
Base = declarative_base()


def get_db():
    """Dependency for FastAPI to get a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
