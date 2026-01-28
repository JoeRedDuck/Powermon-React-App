from sqlalchemy.orm import Session, aliased  # type: ignore
from sqlalchemy import func, and_, or_, desc, text  # type: ignore
from sqlalchemy.exc import IntegrityError  # type: ignore
from datetime import datetime
import models
from typing import List, Optional, Dict, Any, Tuple


def get_devices(db: Session) -> List[Dict[str, Any]]:
    # Sub-query for the latest poll per machine (prioritizing machine_name)
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
    # Handle null/None MAC addresses or empty strings
    if not mac:
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


def unassign_monitor(db: Session, monitor_id: int) -> bool:
    """
    Unassign a monitor from its current machine.
    The monitor remains in the database but is no longer associated with any machine.

    Args:
        db: Database session
        monitor_id: ID of the monitor to unassign

    Returns:
        True if successful, False if monitor not found
    """
    monitor = db.query(models.Monitor).filter(
        models.Monitor.id == monitor_id).first()
    if not monitor:
        return False

    monitor.machine_name = None
    db.commit()
    return True


def delete_monitor(db: Session, monitor_id: int) -> Tuple[bool, Optional[str]]:
    """
    Permanently delete a monitor from the database.

    Args:
        db: Database session
        monitor_id: ID of the monitor to delete

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
        - (True, None) if successful
        - (False, None) if monitor not found
        - (False, error_message) if deletion failed due to constraints
    """
    monitor = db.query(models.Monitor).filter(
        models.Monitor.id == monitor_id).first()
    if not monitor:
        return (False, None)

    try:
        db.delete(monitor)
        db.commit()
        return (True, None)
    except IntegrityError as e:
        db.rollback()
        # Check if it's a foreign key constraint violation
        if "foreign key constraint" in str(e).lower() and "poll" in str(e).lower():
            return (False, "Cannot delete monitor: It has associated poll data. Unassign the monitor instead to keep historical data.")
        return (False, f"Database constraint violation: {str(e)}")


def create_monitor(db: Session, monitor_data) -> tuple[bool, Optional[str]]:
    """
    Create a new monitor, optionally assigning it to a machine.

    Args:
        db: Database session
        monitor_data: MonitorCreate model with id, mac, and optional machine_name

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    try:
        # Check if monitor with this ID already exists
        existing_monitor = db.query(models.Monitor).filter(
            models.Monitor.id == monitor_data.id
        ).first()
        if existing_monitor:
            return (False, f"Monitor with ID {monitor_data.id} already exists")

        # Check if monitor with this MAC already exists
        existing_mac = db.query(models.Monitor).filter(
            models.Monitor.mac == monitor_data.mac
        ).first()
        if existing_mac:
            return (False, f"Monitor with MAC {monitor_data.mac} already exists")

        # If machine_name is provided, validate it exists
        if monitor_data.machine_name:
            machine = db.query(models.Machine).filter(
                models.Machine.name == monitor_data.machine_name
            ).first()
            if not machine:
                return (False, f"Machine '{monitor_data.machine_name}' not found")

            # Orphan any existing monitors on this machine
            existing_monitors = db.query(models.Monitor).filter(
                models.Monitor.machine_name == monitor_data.machine_name
            ).all()
            for existing_monitor in existing_monitors:
                existing_monitor.machine_name = None

        # Create the new monitor
        new_monitor = models.Monitor(
            id=monitor_data.id,
            mac=monitor_data.mac,
            type="IPM",  # Default type
            machine_name=monitor_data.machine_name
        )
        db.add(new_monitor)
        db.commit()
        db.refresh(new_monitor)

        return (True, None)
    except IntegrityError as e:
        db.rollback()
        return (False, f"Database error: {str(e)}")


def update_monitor(db: Session, monitor_id: int, monitor_data) -> tuple[bool, Optional[str]]:
    """
    Update a monitor's ID and/or MAC address.

    Args:
        db: Database session
        monitor_id: Current ID of the monitor to update
        monitor_data: MonitorUpdate model with optional new id and/or mac

    Returns:
        Tuple of (success: bool, error_message: Optional[str])
    """
    try:
        # Find the monitor to update
        monitor = db.query(models.Monitor).filter(
            models.Monitor.id == monitor_id
        ).first()

        if not monitor:
            return (False, f"Monitor with ID {monitor_id} not found")

        # If updating ID, check it doesn't already exist
        if monitor_data.id is not None and monitor_data.id != monitor_id:
            existing_id = db.query(models.Monitor).filter(
                models.Monitor.id == monitor_data.id
            ).first()
            if existing_id:
                return (False, f"Monitor with ID {monitor_data.id} already exists")

            monitor.id = monitor_data.id

        # If updating MAC, check it doesn't already exist
        if monitor_data.mac is not None and monitor_data.mac != monitor.mac:
            existing_mac = db.query(models.Monitor).filter(
                models.Monitor.mac == monitor_data.mac
            ).first()
            if existing_mac:
                return (False, f"Monitor with MAC {monitor_data.mac} already exists")

            # Check if monitor has existing polls - cannot change MAC if polls exist
            poll_count = db.query(models.Poll).filter(
                models.Poll.monitor_mac == monitor.mac
            ).count()
            
            if poll_count > 0:
                return (False, f"Cannot change MAC address: Monitor has {poll_count} existing poll records. MAC addresses cannot be changed once polls exist.")

            monitor.mac = monitor_data.mac

        db.commit()
        return (True, None)
    except IntegrityError as e:
        db.rollback()
        return (False, f"Database error: {str(e)}")


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

    # If the target machine already has monitors, orphan them (set machine_name to None)
    # BUT: don't orphan the monitor we're trying to reassign (avoid self-orphaning)
    existing_monitors = db.query(models.Monitor).filter(
        models.Monitor.machine_name == new_machine_name
    ).all()
    for existing_monitor in existing_monitors:
        # Skip if this is the monitor we're reassigning (compare by MAC, which is unique)
        if existing_monitor.mac != monitor.mac:
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

    # Get the machine associated with this monitor
    # If monitor has no machine_name, we can't update machine info
    if not monitor.machine_name:
        # Monitor is orphaned - cannot update machine info
        return False

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

        # CRITICAL: Use different strategies based on whether FK constraints are DEFERRABLE
        deferrable_count = 0  # Default for non-PostgreSQL databases

        if db.bind.dialect.name == 'postgresql':
            # Check if constraints are deferrable
            result = db.execute(text("""
                SELECT COUNT(*) FROM pg_constraint 
                WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey')
                AND condeferrable = true
            """))
            deferrable_count = result.scalar()

            if deferrable_count == 2:
                # Constraints are DEFERRABLE - use SET CONSTRAINTS (no locks!)
                db.execute(text(
                    "SET CONSTRAINTS monitor_machine_name_fkey, poll_machine_name_fkey DEFERRED"))
            else:
                # Constraints NOT deferrable - use lock with 2 second timeout
                db.execute(text("SET LOCAL lock_timeout = '2s'"))
                db.execute(
                    text("ALTER TABLE monitor DROP CONSTRAINT IF EXISTS monitor_machine_name_fkey"))
                db.execute(
                    text("ALTER TABLE poll DROP CONSTRAINT IF EXISTS poll_machine_name_fkey"))

        # 1. Update the machine's primary key using raw SQL
        db.execute(
            text(
                "UPDATE machine SET machine_name = :new_name WHERE machine_name = :old_name"),
            {"new_name": new_name, "old_name": old_name}
        )

        # 2. Update monitor's FK reference using raw SQL
        db.execute(
            text(
                "UPDATE monitor SET machine_name = :new_name WHERE machine_name = :old_name"),
            {"new_name": new_name, "old_name": old_name}
        )

        # 3. Update all polls using raw SQL
        db.execute(
            text("UPDATE poll SET machine_name = :new_name WHERE machine_name = :old_name"),
            {"new_name": new_name, "old_name": old_name}
        )

        if db.bind.dialect.name == 'postgresql' and deferrable_count != 2:
            # Recreate constraints if we dropped them
            db.execute(text("""
                ALTER TABLE monitor ADD CONSTRAINT monitor_machine_name_fkey 
                FOREIGN KEY (machine_name) REFERENCES machine(machine_name)
            """))
            db.execute(text("""
                ALTER TABLE poll ADD CONSTRAINT poll_machine_name_fkey 
                FOREIGN KEY (machine_name) REFERENCES machine(machine_name) ON DELETE CASCADE
            """))

        # 4. Expunge the old objects and reload with new name
        db.expunge(machine)
        db.expunge(monitor)

        # Reload the machine and monitor with the new name
        machine = db.query(models.Machine).filter_by(name=new_name).first()
        monitor = db.query(models.Monitor).filter_by(mac=mac).first()

        # Verify reload was successful
        if not machine or not monitor:
            db.rollback()
            return False

    # Update other machine fields (now safe to update after reload)
    if device_data.machine_type is not None:
        machine.type = device_data.machine_type
    if device_data.location is not None:
        machine.location = device_data.location

    db.commit()
    return True


def add_device(db: Session, device_data) -> bool:
    # Check if monitor with this MAC already exists
    if db.query(models.Monitor).filter(models.Monitor.mac == device_data.mac).first():
        return False

    # 1. Ensure Machine exists - create or update
    machine = db.query(models.Machine).filter(
        models.Machine.name == device_data.name).first()
    if not machine:
        # Create new machine
        machine = models.Machine(
            name=device_data.name,  # Attribute name is 'name', column is 'machine_name'
            type=device_data.machine_type,
            location=device_data.location
        )
        db.add(machine)
    else:
        # Update existing machine's type and location
        machine.type = device_data.machine_type
        machine.location = device_data.location

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
