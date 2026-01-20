from sqlalchemy.orm import Session, aliased  # type: ignore
from sqlalchemy import func, and_, desc  # type: ignore
from datetime import datetime
import models
from typing import List, Optional, Dict, Any


def get_devices(db: Session) -> List[Dict[str, Any]]:
    # Sub-query for the latest poll per machine (prioritizing machine_name)
    sub_stmt = db.query(
        models.Poll.machine_name,
        func.max(models.Poll.poll_time).label("max_time")
    ).group_by(models.Poll.machine_name).subquery()

    latest_poll = aliased(models.Poll)

    results = (
        db.query(models.Monitor, models.Machine, latest_poll)
        .outerjoin(models.Monitor, models.Monitor.machine_name == models.Machine.name)
        .outerjoin(sub_stmt, models.Machine.name == sub_stmt.c.machine_name)
        .outerjoin(latest_poll, and_(
            latest_poll.machine_name == sub_stmt.c.machine_name,
            latest_poll.poll_time == sub_stmt.c.max_time
        ))
        .all()
    )

    return [{
        "mac": m.mac if m else None,
        "id": m.id if m else None,
        "name": mach.name,
        "type": m.type if m else None,
        "machine_type": mach.type,
        "location": mach.location,
        "last_seen": p.poll_time if p else None,
        "last_power": p.power_usage if p else None
    } for m, mach, p in results]


def get_power(db: Session, mac: str, cutoff: datetime) -> List[Dict[str, Any]]:
    # First get the machine_name associated with this monitor MAC
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if not monitor:
        return []

    # Query polls by machine_name (priority) instead of monitor_mac
    rows = db.query(models.Poll).filter(
        models.Poll.machine_name == monitor.machine_name,
        models.Poll.poll_time >= cutoff
    ).order_by(models.Poll.poll_time.asc()).all()
    return [{"value": r.power_usage, "date": r.poll_time} for r in rows]


def get_no_device_polls(db: Session, mac: str) -> int:
    # Get the machine_name associated with this monitor MAC
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if not monitor:
        return 0

    # Query polls by machine_name (priority) instead of monitor_mac
    return db.query(models.Poll).filter(models.Poll.machine_name == monitor.machine_name).count()


def get_device(db: Session, mac: str) -> Optional[Dict[str, Any]]:
    devices = get_devices(db)
    return next((d for d in devices if d["mac"] == mac), None)


def get_device_by_name(db: Session, machine_name: str) -> Optional[Dict[str, Any]]:
    """Get device information by machine name."""
    devices = get_devices(db)
    return next((d for d in devices if d["name"] == machine_name), None)


def get_locations(db: Session) -> List[str]:
    return [r[0] for r in db.query(models.Machine.location).distinct().filter(models.Machine.location.isnot(None)).all()]


def get_monitors(db: Session) -> List[Dict[str, Any]]:
    results = db.query(models.Monitor).all()
    return [{"mac": m.mac, "id": m.id, "name": m.machine_name} for m in results]


def get_machine_types(db: Session) -> List[str]:
    return [r[0] for r in db.query(models.Machine.type).distinct().filter(models.Machine.type.isnot(None)).all()]


def delete_machine_by_name(db: Session, machine_name: str) -> bool:
    """Delete a machine by its name. Also deletes any associated monitors."""
    machine = db.query(models.Machine).filter(
        models.Machine.name == machine_name).first()
    if not machine:
        return False

    # Delete any monitors associated with this machine
    monitors = db.query(models.Monitor).filter(
        models.Monitor.machine_name == machine_name).all()
    for monitor in monitors:
        db.delete(monitor)

    # Delete the machine
    db.delete(machine)
    db.commit()
    return True


def delete_device(db: Session, mac: str) -> bool:
    """Delete a device by MAC address. Also deletes the associated machine."""
    # Handle null/None MAC addresses
    if not mac or mac.lower() == 'null' or mac.lower() == 'none':
        return False

    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if monitor:
        machine_name = monitor.machine_name

        # Delete the monitor
        db.delete(monitor)

        # Delete associated machine if it exists
        if machine_name:
            machine = db.query(models.Machine).filter(
                models.Machine.name == machine_name).first()
            if machine:
                db.delete(machine)

        db.commit()
        return True
    return False


def reassign_monitor(db: Session, monitor_id: int, new_machine_name: str) -> bool:
    """
    Reassign a monitor to a different machine.

    - The monitor is updated to point to the new machine
    - The old monitor (if any) on the source machine remains orphaned (machine_name = None)
    - If the monitor was on another machine, that machine is left without a monitor
    - Polls remain associated with machine_name (they don't move with the monitor)

    Args:
        db: Database session
        monitor_id: ID of the monitor to reassign
        new_machine_name: Name of the machine to assign the monitor to

    Returns:
        True if successful, False if monitor or machine not found
    """
    # Check if monitor exists
    monitor = db.query(models.Monitor).filter(
        models.Monitor.id == monitor_id).first()
    if not monitor:
        return False

    # Check if target machine exists
    machine = db.query(models.Machine).filter(
        models.Machine.name == new_machine_name).first()
    if not machine:
        return False

    # If the target machine already has a monitor, orphan it (set machine_name to None)
    existing_monitor = db.query(models.Monitor).filter(
        models.Monitor.machine_name == new_machine_name).first()
    if existing_monitor:
        existing_monitor.machine_name = None

    # Reassign the monitor to the new machine
    monitor.machine_name = new_machine_name

    db.commit()
    return True


def update_device(db: Session, mac: str, device_data) -> bool:
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == mac).first()
    if not monitor:
        return False

    # Don't update monitor.id here - use reassign_monitor() for monitor reassignment

    # Update machine info linked to this monitor
    machine = db.query(models.Machine).filter(
        models.Machine.name == monitor.machine_name).first()
    if not machine:
        return False
    
    old_name = machine.name
    new_name = device_data.name
    
    # If name is changing, check for duplicates and cascade updates
    if new_name != old_name:
        # Check if new name already exists
        existing_machine = db.query(models.Machine).filter(
            models.Machine.name == new_name).first()
        if existing_machine:
            # Duplicate name - don't allow
            return False
        
        # Update all polls that reference the old machine name
        db.query(models.Poll).filter(
            models.Poll.machine_name == old_name
        ).update({"machine_name": new_name})
        
        # Update the monitor's machine_name reference
        monitor.machine_name = new_name
        
        # Update the machine name (primary key)
        machine.name = new_name
    
    # Update other machine fields
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
        type="IPM",
        machine_name=device_data.name
    ))
    db.commit()
    return True


def insert_poll(db: Session, monitor_mac: str, power_usage: int, poll_time: datetime) -> bool:
    """
    Insert a poll record with automatic machine_name resolution.

    This function ensures:
    1. The monitor exists in the database
    2. The monitor is associated with a valid machine
    3. Both monitor_mac and machine_name are saved in the poll record

    Args:
        db: Database session
        monitor_mac: MAC address of the reporting monitor
        power_usage: Power reading in watts
        poll_time: Timestamp of the reading

    Returns:
        True if poll was inserted successfully, False if monitor not found

    Raises:
        IntegrityError: If machine_name foreign key constraint fails
    """
    # Lookup the monitor to get its associated machine_name
    monitor = db.query(models.Monitor).filter(
        models.Monitor.mac == monitor_mac).first()

    if not monitor:
        # Monitor doesn't exist - cannot insert poll
        return False

    if not monitor.machine_name:
        # Monitor exists but has no machine assigned - cannot insert poll
        raise ValueError(
            f"Monitor {monitor_mac} has no associated machine_name")

    # Verify the machine exists (defensive check for FK constraint)
    machine = db.query(models.Machine).filter(
        models.Machine.name == monitor.machine_name).first()
    if not machine:
        raise ValueError(
            f"Machine '{monitor.machine_name}' referenced by monitor {monitor_mac} does not exist")

    # Create and insert the poll with both monitor_mac and machine_name
    poll = models.Poll(
        monitor_mac=monitor_mac,
        machine_name=monitor.machine_name,
        power_usage=power_usage,
        poll_time=poll_time
    )
    db.add(poll)
    db.commit()
    return True


def add_notification_token(db: Session, token: str, device_name: Optional[str] = None) -> bool:
    """
    Add an Expo push notification token to the database.
    Returns True if added, False if token already exists.
    """
    # Check if token already exists
    existing = db.query(models.NotificationToken).filter(
        models.NotificationToken.token == token).first()

    if existing:
        # Update device name if provided
        if device_name:
            existing.device_name = device_name
            db.commit()
        return False

    # Add new token
    new_token = models.NotificationToken(
        token=token,
        device_name=device_name
    )
    db.add(new_token)
    db.commit()
    return True


def get_all_notification_tokens(db: Session) -> List[str]:
    """Get all registered notification tokens."""
    tokens = db.query(models.NotificationToken.token).all()
    return [t[0] for t in tokens]


def delete_notification_token(db: Session, token: str) -> bool:
    """Delete a notification token. Returns True if deleted, False if not found."""
    token_obj = db.query(models.NotificationToken).filter(
        models.NotificationToken.token == token).first()

    if token_obj:
        db.delete(token_obj)
        db.commit()
        return True
    return False
