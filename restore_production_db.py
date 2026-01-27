#!/usr/bin/env python3
"""Restore production database to match settings.json"""

from database import SessionLocal
import models
import json

# Load settings.json
with open('settings.json', 'r') as f:
    settings = json.load(f)

with SessionLocal() as db:
    # Clear all existing data
    print("Clearing existing data...")
    db.query(models.Poll).delete()
    db.query(models.Monitor).delete()
    db.query(models.Machine).delete()
    db.commit()

    print("Restoring from settings.json...")

    # Add machines and monitors from settings.json
    for device in settings['devices']:
        # Add machine
        machine = models.Machine(
            name=device['name'],
            type=device['machine_type'],
            location=device['location']
        )
        db.add(machine)

        # Add monitor
        monitor = models.Monitor(
            mac=device['mac'],
            id=int(device['id']),
            type=device['type'],
            machine_name=device['name']
        )
        db.add(monitor)

        print(
            f"Added: {device['name']} with monitor {device['id']} (MAC: {device['mac']})")

    db.commit()
    print("\n✅ Database restored to match settings.json")

    # Verify
    print("\n=== VERIFICATION ===")
    machines = db.query(models.Machine).all()
    monitors = db.query(models.Monitor).order_by(models.Monitor.id).all()

    print(f"Machines: {len(machines)}")
    print(f"Monitors: {len(monitors)}")

    print("\n=== MACHINES ===")
    for m in machines:
        print(f"{m.name}: type={m.type}, location={m.location}")

    print("\n=== MONITORS ===")
    for mon in monitors:
        print(f"ID={mon.id}, MAC={mon.mac}, Machine={mon.machine_name}")
