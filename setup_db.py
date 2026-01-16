import json
import sys
import os
from sqlalchemy import create_engine, text  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
import models
from database import DATABASE_URL, Base


def main():
    print(f"Connecting to: {DATABASE_URL}")
    try:
        engine = create_engine(DATABASE_URL)
        Session = sessionmaker(bind=engine)
        session = Session()
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

    print("Recreating schema...")
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    # Load settings
    try:
        with open("settings.json", "r") as f:
            data = json.load(f)
            devices_data = data.get("devices", [])
    except FileNotFoundError:
        print("settings.json not found.")
        sys.exit(1)

    print(f"Importing {len(devices_data)} devices...")

    machines_seen = set()

    for device in devices_data:
        machine_name = device["name"]

        # 1. Create Machine (Now includes Location)
        if machine_name not in machines_seen:
            new_machine = models.Machine(
                name=machine_name,
                type=device["machine_type"],
                location=device["location"]  # <-- LOCATION SAVED HERE
            )
            session.add(new_machine)
            machines_seen.add(machine_name)

        # 2. Create Monitor (Location removed)
        new_monitor = models.Monitor(
            mac=device["mac"],
            id=int(device["id"]),
            type=device["type"],
            machine_name=machine_name
        )
        session.add(new_monitor)

    try:
        session.commit()
        print("Data import complete.")
    except Exception as e:
        print(f"Error: {e}")
        session.rollback()

    # Index - Updated to use machine_name (priority) for optimal query performance
    try:
        with engine.connect() as conn:
            # Create index on machine_name since queries now prioritize machine over monitor
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS poll_machine_idx ON poll (machine_name, poll_time DESC)"))
            # Keep the old index for backward compatibility if needed
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS poll_monitor_idx ON poll (device_mac_address, poll_time DESC)"))
            conn.commit()
        print("Indexes added.")
    except Exception as e:
        print(f"Index error: {e}")

    session.close()


if __name__ == "__main__":
    main()
