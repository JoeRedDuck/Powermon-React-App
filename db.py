from sqlalchemy.orm import Session, aliased  # type: ignore
from sqlalchemy import func, and_, desc  # type: ignore
from datetime import datetime
import models
from typing import List, Optional, Dict, Any


def get_devices(db: Session) -> List[Dict[str, Any]]:
    # Sub-query for the latest poll per monitor using corrected attribute: monitor_mac
    sub_stmt = db.query(
        models.Poll.monitor_mac,
        func.max(models.Poll.poll_time).label("max_time")
    ).group_by(models.Poll.monitor_mac).subquery()

    latest_poll = aliased(models.Poll)

    results = (
        db.query(models.Monitor, models.Machine, latest_poll)
        .join(models.Machine, models.Monitor.machine_name == models.Machine.name)
        .outerjoin(sub_stmt, models.Monitor.mac == sub_stmt.c.monitor_mac)
        .outerjoin(latest_poll, and_(
            latest_poll.monitor_mac == sub_stmt.c.monitor_mac,
            latest_poll.poll_time == sub_stmt.c.max_time
        ))
        .all()
    )

    return [{
        "mac": m.mac,
        "id": m.id,
        "name": m.machine_name,
        "ip": m.ip,
        "type": m.type,
        "machine_type": mach.type,
        "location": mach.location,
        "last_seen": p.poll_time if p else None,
        "last_power": p.power_usage if p else None
    } for m, mach, p in results]


def get_power(db: Session, mac: str, cutoff: datetime) -> List[Dict[str, Any]]:
    rows = db.query(models.Poll).filter(
        models.Poll.monitor_mac == mac,  # Updated attribute name
        models.Poll.poll_time >= cutoff
    ).order_by(models.Poll.poll_time.asc()).all()
    return [{"value": r.power_usage, "date": r.poll_time} for r in rows]


def get_no_device_polls(db: Session, mac: str) -> int:
    # Updated attribute name
    return db.query(models.Poll).filter(models.Poll.monitor_mac == mac).count()


def get_device(db: Session, mac: str) -> Optional[Dict[str, Any]]:
    devices = get_devices(db)
    return next((d for d in devices if d["mac"] == mac), None)


def get_locations(db: Session) -> List[str]:
    return [r[0] for r in db.query(models.Machine.location).distinct().filter(models.Machine.location.isnot(None)).all()]


def get_machine_types(db: Session) -> List[str]:
    return [r[0] for r in db.query(models.Machine.type).distinct().filter(models.Machine.type.isnot(None)).all()]


def delete_device(db: Session, mac: str) -> bool:
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if monitor:
        db.delete(monitor)
        db.commit()
        return True
    return False


def update_device(db: Session, mac: str, device_data) -> bool:
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if not monitor:
        return False

    monitor.id = device_data.id
    monitor.ip = device_data.ip

    # Update machine info linked to this monitor
    machine = db.query(models.Machine).filter(
        models.Machine.name == monitor.machine_name).first()
    if machine:
        if device_data.machine_type:
            machine.type = device_data.machine_type
        if device_data.location:
            machine.location = device_data.location
    db.commit()
    return True


def add_device(db: Session, device_data) -> bool:
    # Check if monitor with this MAC already exists
    if db.query(models.Monitor).filter(models.Monitor.mac == device_data.mac).first():
        return False

    # 1. Ensure Machine exists in new schema
    if not db.query(models.Machine).filter(models.Machine.name == device_data.name).first():
        db.add(models.Machine(
            name=device_data.name,  # Attribute name is 'name', column is 'machine_name'
            type=device_data.machine_type,
            location=device_data.location
        ))
        db.flush()
    # 2. Add Monitor
    db.add(models.Monitor(
        mac=device_data.mac,
        id=device_data.id,
        ip=device_data.ip,
        type="IPM",
        machine_name=device_data.name
    ))
    db.commit()
    return True
