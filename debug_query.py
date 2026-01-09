from sqlalchemy import create_engine, func, and_  # type: ignore
from sqlalchemy.orm import sessionmaker, aliased  # type: ignore
from database import DATABASE_URL
import models

print(f"Connecting to: {DATABASE_URL}")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
session = Session()

print("\n--- TEST 1: Simple Monitor Query ---")
try:
    monitors = session.query(models.Monitor).all()
    print(f"Result: {len(monitors)} monitors found.")
except Exception as e:
    print(f"FAILED: {e}")

print("\n--- TEST 2: Join Machine ---")
try:
    results = (
        session.query(models.Monitor, models.Machine)
        .outerjoin(models.Machine, models.Monitor.machine_name == models.Machine.name)
        .all()
    )
    print(f"Result: {len(results)} rows found.")
except Exception as e:
    print(f"FAILED: {e}")

print("\n--- TEST 3: The Full 'get_devices' Query ---")
try:
    # This is the exact code from db.py
    subquery = (
        session.query(
            models.Poll.monitor_mac,
            func.max(models.Poll.poll_time).label("max_time")
        )
        .group_by(models.Poll.monitor_mac)
        .subquery()
    )

    latest_poll = aliased(models.Poll)

    results = (
        session.query(models.Monitor, models.Machine, latest_poll)
        .outerjoin(models.Machine, models.Monitor.machine_name == models.Machine.name)
        .outerjoin(subquery, models.Monitor.mac == subquery.c.monitor_mac)
        .outerjoin(latest_poll, and_(
            latest_poll.monitor_mac == subquery.c.monitor_mac,
            latest_poll.poll_time == subquery.c.max_time
        ))
        .all()
    )
    print(f"Result: {len(results)} rows found.")
except Exception as e:
    print(f"FAILED: {e}")
