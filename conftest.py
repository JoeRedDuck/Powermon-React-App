"""
Pytest configuration and safety checks
"""
import os
import sys
import pytest


def pytest_configure(config):
    """
    Safety check: Ensure tests never use production database
    """
    # Check if any dangerous production database access is attempted
    db_host = os.getenv('DB_HOST')
    db_name = os.getenv('DB_NAME')

    if db_host and db_name:
        print(f"\n⚠️  WARNING: Production database environment variables detected!")
        print(f"   DB_HOST: {db_host}")
        print(f"   DB_NAME: {db_name}")
        print(f"   Tests should use in-memory SQLite databases only.\n")

    # Verify no test is trying to use production database URL
    if 'postgresql' in str(config.args):
        pytest.exit(
            "❌ ERROR: Tests should not use PostgreSQL production database!", returncode=1)


def pytest_collection_modifyitems(config, items):
    """
    Mark dangerous tests that shouldn't run during normal pytest execution
    """
    for item in items:
        # Mark PostgreSQL tests as requiring explicit flag
        if "test_pg_machine_rename" in str(item.fspath):
            if not os.getenv('TEST_PRODUCTION_DB') == 'true':
                item.add_marker(pytest.mark.skip(
                    reason="Requires TEST_PRODUCTION_DB=true (uses production database)"
                ))
