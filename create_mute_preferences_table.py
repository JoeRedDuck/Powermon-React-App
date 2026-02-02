#!/usr/bin/env python3
"""
Script to create/update database tables for the mute preferences feature.
This script creates the device_mute_preferences table.
"""

from database import engine, Base
import models


def create_tables():
    """Create all tables defined in models.py if they don't exist."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully!")
    print("\nCreated/verified tables:")
    print("  - machine")
    print("  - monitor")
    print("  - poll")
    print("  - notification_token")
    print("  - device_mute_preferences (NEW)")


if __name__ == "__main__":
    create_tables()
