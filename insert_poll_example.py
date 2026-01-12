#!/usr/bin/env python3
"""
Example script for inserting poll data into the database.

This demonstrates the correct way to insert poll records with the new schema
that includes machine_name. External data collection scripts should follow
this pattern.

Usage:
    python insert_poll_example.py <monitor_mac> <power_usage>
"""

import sys
from datetime import datetime, timezone
from database import SessionLocal
import db


def main():
    if len(sys.argv) != 3:
        print("Usage: python insert_poll_example.py <monitor_mac> <power_usage>")
        print("Example: python insert_poll_example.py AA:BB:CC:DD:EE:FF 1500")
        sys.exit(1)

    monitor_mac = sys.argv[1]
    power_usage = int(sys.argv[2])
    poll_time = datetime.now(timezone.utc)

    with SessionLocal() as session:
        try:
            success = db.insert_poll(
                session, monitor_mac, power_usage, poll_time)
            if success:
                print(
                    f"✓ Poll inserted successfully for monitor {monitor_mac}")
                print(f"  Power: {power_usage}W at {poll_time}")
            else:
                print(f"✗ Failed: Monitor {monitor_mac} not found in database")
                print(
                    "  Make sure the monitor is registered first using POST /api/v1/devices")
                sys.exit(1)
        except ValueError as e:
            print(f"✗ Failed: {e}")
            sys.exit(1)
        except Exception as e:
            print(f"✗ Database error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
