#!/usr/bin/env python3
"""Debug script to check reassign behavior."""

from database import SessionLocal, engine
import models
from sqlalchemy.orm import aliased
from sqlalchemy import and_, func
from typing import List, Dict, Any

# Create tables
models.Base.metadata.create_all(bind=engine)


def get_devices(db) -> List[Dict[str, Any]]:
    """Same logic as db.py get_devices()"""
    sub_stmt = db.query(
        models.Poll.machine_name,
        func.max(models.Poll.poll_time).label("max_time")
    ).group_by(models.Poll.machine_name).subquery()

    latest_poll = aliased(models.Poll)

    results = (
        db.query(models.Machine, models.Monitor, latest_poll)
        .outerjoin(models.Monitor, models.Monitor.machine_name == models.Machine.name)
        .outerjoin(sub_stmt, models.Machine.name == sub_stmt.c.machine_name)
        .outerjoin(latest_poll, and_(
            latest_poll.machine_name == sub_stmt.c.machine_name,
            latest_poll.poll_time == sub_stmt.c.max_time
        ))
        .all()
    )

    return [{
        "mac": mon.mac if mon else None,
        "id": mon.id if mon else None,
        "name": mach.name,
        "type": mon.type if mon else None,
        "machine_type": mach.type,
        "location": mach.location,
        "last_seen": p.poll_time if p else None,
        "last_power": p.power_usage if p else None
    } for mach, mon, p in results]


with SessionLocal() as db:
    # Create Machine A (monitor will get auto ID, probably 1)
    mach_a = models.Machine(name="Machine A", type="CNC", location="Shop")
    db.add(mach_a)
    db.flush()

    mon_1 = models.Monitor(mac="AA:AA:AA", type="IPM",
                           machine_name="Machine A")
    db.add(mon_1)
    db.flush()
    print(
        f"Created Monitor 1: ID={mon_1.id}, MAC={mon_1.mac}, Machine={mon_1.machine_name}")

    # Create Machine B with monitor ID 2
    mach_b = models.Machine(name="Machine B", type="CNC", location="Shop")
    db.add(mach_b)
    db.flush()

    mon_2 = models.Monitor(id=2, mac="BB:BB:BB",
                           type="IPM", machine_name="Machine B")
    db.add(mon_2)
    db.commit()
    print(
        f"Created Monitor 2: ID={mon_2.id}, MAC={mon_2.mac}, Machine={mon_2.machine_name}")

    print("\n--- BEFORE REASSIGNMENT ---")
    devices = get_devices(db)
    for d in devices:
        print(f"{d['name']}: MAC={d['mac']}, ID={d['id']}")

    # List all monitors
    print("\nAll monitors:")
    for mon in db.query(models.Monitor).all():
        print(f"  Monitor {mon.id}: MAC={mon.mac}, Machine={mon.machine_name}")

    # Reassign monitor 2 to Machine A
    print("\n--- REASSIGNING MONITOR 2 TO MACHINE A ---")
    mon_2.machine_name = "Machine A"

    # Orphan existing monitor on Machine A
    existing = db.query(models.Monitor).filter(
        models.Monitor.machine_name == "Machine A",
        models.Monitor.id != 2
    ).first()
    if existing:
        print(f"Orphaning monitor {existing.id} (MAC={existing.mac})")
        existing.machine_name = None

    db.commit()

    print("\n--- AFTER REASSIGNMENT ---")
    devices = get_devices(db)
    for d in devices:
        print(f"{d['name']}: MAC={d['mac']}, ID={d['id']}")

    # List all monitors
    print("\nAll monitors:")
    for mon in db.query(models.Monitor).all():
        print(f"  Monitor {mon.id}: MAC={mon.mac}, Machine={mon.machine_name}")

    # Debug: Check raw SQL
    print("\n--- RAW QUERY DEBUG ---")
    results = (
        db.query(models.Machine, models.Monitor)
        .outerjoin(models.Monitor, models.Monitor.machine_name == models.Machine.name)
        .all()
    )
    for mach, mon in results:
        print(
            f"Machine={mach.name}, Monitor={'None' if mon is None else f'ID={mon.id} MAC={mon.mac}'}")
