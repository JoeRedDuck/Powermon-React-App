"""
Pytest configuration and safety checks.
Provides a per-test SQLite in-memory database so every test is fully isolated.
"""
import os
import sys
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ---------------------------------------------------------------------------
# Safety checks
# ---------------------------------------------------------------------------


def pytest_configure(config):
    db_host = os.getenv('DB_HOST')
    db_name = os.getenv('DB_NAME')
    if db_host and db_name:
        print(f"\n⚠️  WARNING: Production database environment variables detected!")
        print(f"   DB_HOST: {db_host}")
        print(f"   DB_NAME: {db_name}")
        print(f"   Tests should use in-memory SQLite databases only.\n")
    if 'postgresql' in str(config.args):
        pytest.exit(
            "❌ ERROR: Tests should not use PostgreSQL production database!", returncode=1)


def pytest_collection_modifyitems(config, items):
    for item in items:
        if "test_pg_machine_rename" in str(item.fspath):
            if not os.getenv('TEST_PRODUCTION_DB') == 'true':
                item.add_marker(pytest.mark.skip(
                    reason="Requires TEST_PRODUCTION_DB=true (uses production database)"
                ))


# ---------------------------------------------------------------------------
# Shared test-database fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _test_db():
    """Create a fresh SQLite in-memory database for every single test.

    • Creates all tables from ``database.Base.metadata``
    • Overrides the FastAPI ``get_db`` dependency so every request uses
      this test database
    • Tears down after the test
    """
    from database import Base
    import app as _app  # import here to avoid circular issues

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _override_get_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    _app.app.dependency_overrides[_app.get_db] = _override_get_db
    yield TestSession
    _app.app.dependency_overrides.clear()
