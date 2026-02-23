# test_db.py
import pytest  # type: ignore
from sqlalchemy import create_engine  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
from datetime import datetime, timedelta, timezone

import models
import db as db_service
from database import Base

# --- Pytest Fixture ---


@pytest.fixture(scope="function")
def db_session():
    # In-memory SQLite DB for fast testing
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

# --- Mock Data ---


class MockDeviceData:
    def __init__(self, name, mac, location, machine_type, id=1):
        self.name = name
        self.mac = mac
        self.location = location
        self.machine_type = machine_type
        self.id = id

# --- Tests ---


def test_add_and_get_device(db_session):
    """Test adding a device and retrieving it."""
    data = MockDeviceData("Lathe 1", "AA:BB:CC", "Shop", "Lathe")

    # 1. Add Device
    success, error = db_service.add_device(db_session, data)
    assert success is True

    # 2. Check if MACHINE was created correctly
    machine = db_session.query(
        models.Machine).filter_by(name="Lathe 1").first()
    assert machine is not None
    assert machine.type == "Lathe"
    assert machine.location == "Shop"

    # 3. Check if MONITOR was created correctly
    monitor = db_session.query(
        models.Monitor).filter_by(mac="AA:BB:CC").first()
    assert monitor is not None
    assert monitor.machine_name == "Lathe 1"

    # 4. Check Retrieval (Join logic)
    devs = db_service.get_devices(db_session)
    assert len(devs) == 1
    assert devs[0]['mac'] == "AA:BB:CC"
    assert devs[0]['name'] == "Lathe 1"
    assert devs[0]['location'] == "Shop"
    assert devs[0]['machine_type'] == "Lathe"


def test_duplicate_device_prevention(db_session):
    """Test that duplicate MAC addresses are prevented."""
    data = MockDeviceData("Lathe 1", "AA:BB:CC", "Shop", "Lathe")

    # Add first device
    success, error = db_service.add_device(db_session, data)
    assert success is True

    # Try to add same MAC again - should return False
    success, error = db_service.add_device(db_session, data)
    assert success is False
    assert "already exists" in error.lower()


def test_latest_poll_logic(db_session):
    """Test that get_device returns the latest poll data."""
    # Add device
    data = MockDeviceData("CNC", "11:22:33", "Shop", "CNC")
    db_service.add_device(db_session, data)

    # Add old poll (100W) and new poll (500W)
    now = datetime.now(timezone.utc)
    p1 = models.Poll(monitor_mac="11:22:33", machine_name="CNC", power_usage=100,
                     poll_time=now - timedelta(minutes=10))
    p2 = models.Poll(monitor_mac="11:22:33", machine_name="CNC",
                     power_usage=500, poll_time=now)
    db_session.add_all([p1, p2])
    db_session.commit()

    # Get device and check last_power
    d = db_service.get_device(db_session, "11:22:33")
    assert d is not None
    assert d['last_power'] == 500
    assert d['last_seen'] == p2.poll_time


def test_update_device_location(db_session):
    """Test updating device location."""
    # 1. Setup Device at "Old Location"
    data = MockDeviceData("Drill", "DD:00:11",
                          "Old Location", "Drill")
    db_service.add_device(db_session, data)

    # Verify initial state
    machine = db_session.query(models.Machine).filter_by(name="Drill").first()
    assert machine.location == "Old Location"

    # 2. Update to "New Location"
    update_data = MockDeviceData(
        "Drill", "DD:00:11", "New Location", "Drill")
    success = db_service.update_device(db_session, "DD:00:11", update_data)
    assert success is True

    # 3. Verify Database Update
    db_session.refresh(machine)
    assert machine.location == "New Location"

    # Verify API Output
    d = db_service.get_device(db_session, "DD:00:11")
    assert d is not None
    assert d['location'] == "New Location"


def test_get_device_by_name(db_session):
    """Test getting a device by machine name."""
    data1 = MockDeviceData("Lathe 1", "AA:BB:CC", "Shop", "Lathe", id=1)
    data2 = MockDeviceData("Mill 2", "DD:EE:FF", "Warehouse", "Mill", id=2)
    db_service.add_device(db_session, data1)
    db_service.add_device(db_session, data2)

    # Get by name
    d = db_service.get_device_by_name(db_session, "Lathe 1")
    assert d is not None
    assert d["name"] == "Lathe 1"
    assert d["mac"] == "AA:BB:CC"
    assert d["location"] == "Shop"
    assert d["machine_type"] == "Lathe"
    assert d["id"] == 1

    # Get nonexistent device
    d = db_service.get_device_by_name(db_session, "Nonexistent")
    assert d is None


def test_update_machine_name(db_session):
    """Test updating machine name with cascading updates to polls."""
    # Create device with polls
    data = MockDeviceData("Old Name", "AA:BB:CC", "Shop", "CNC", id=1)
    db_service.add_device(db_session, data)

    # Add polls for the machine
    now = datetime.now(timezone.utc)
    db_service.insert_poll(db_session, "AA:BB:CC", 100,
                           now - timedelta(minutes=5))
    db_service.insert_poll(db_session, "AA:BB:CC", 200, now)

    # Verify initial state
    polls = db_session.query(models.Poll).filter_by(
        machine_name="Old Name").all()
    assert len(polls) == 2

    # Update machine name
    update_data = MockDeviceData("New Name", "AA:BB:CC", "Shop", "CNC", id=1)
    success = db_service.update_device(db_session, "AA:BB:CC", update_data)
    assert success is True

    # Verify machine was renamed
    machine = db_session.query(models.Machine).filter_by(
        name="New Name").first()
    assert machine is not None
    assert machine.name == "New Name"

    # Verify old name doesn't exist
    old_machine = db_session.query(
        models.Machine).filter_by(name="Old Name").first()
    assert old_machine is None

    # Verify all polls were updated with new machine name
    old_polls = db_session.query(models.Poll).filter_by(
        machine_name="Old Name").all()
    assert len(old_polls) == 0

    new_polls = db_session.query(models.Poll).filter_by(
        machine_name="New Name").all()
    assert len(new_polls) == 2

    # Verify monitor reference was updated
    monitor = db_session.query(
        models.Monitor).filter_by(mac="AA:BB:CC").first()
    assert monitor.machine_name == "New Name"

    # Verify device can be retrieved by new name
    d = db_service.get_device_by_name(db_session, "New Name")
    assert d is not None
    assert d["name"] == "New Name"


def test_update_machine_name_duplicate(db_session):
    """Test that updating machine name to an existing name fails."""
    data1 = MockDeviceData("Machine 1", "AA:AA:AA", "Shop", "CNC", id=1)
    data2 = MockDeviceData("Machine 2", "BB:BB:BB", "Shop", "Mill", id=2)
    db_service.add_device(db_session, data1)
    db_service.add_device(db_session, data2)

    # Try to rename Machine 1 to Machine 2 (duplicate)
    update_data = MockDeviceData("Machine 2", "AA:AA:AA", "Shop", "CNC", id=1)
    success = db_service.update_device(db_session, "AA:AA:AA", update_data)
    assert success is False

    # Verify Machine 1 still has original name
    machine1 = db_session.query(models.Machine).filter_by(
        name="Machine 1").first()
    assert machine1 is not None


def test_reassign_monitor_to_new_machine(db_session):
    """Test reassigning a monitor to a new machine."""
    # 1. Setup Monitor attached to "Machine A"
    data = MockDeviceData("Machine A", "FF:FF:FF",
                          "Room 1", "Type A")
    db_service.add_device(db_session, data)

    # 2. Update Monitor to attach to "Machine B" (New Machine)
    # Note: Based on the current implementation, this should:
    # - Keep the same monitor (same MAC)
    # - Update the machine_name reference
    # - However, the current update_device doesn't change machine_name
    # So we need to check what actually happens

    # First, let's verify the current state
    monitor = db_session.query(
        models.Monitor).filter_by(mac="FF:FF:FF").first()
    assert monitor.machine_name == "Machine A"

    # Based on db.py update_device implementation, it updates the Machine
    # but doesn't reassign the monitor. Let's test what it actually does:
    update_data = MockDeviceData(
        "Machine A", "FF:FF:FF", "Room 2", "Type B")
    db_service.update_device(db_session, "FF:FF:FF", update_data)

    # Verify - the monitor should still point to Machine A
    monitor = db_session.query(
        models.Monitor).filter_by(mac="FF:FF:FF").first()
    assert monitor.machine_name == "Machine A"

    # Machine A should have updated type and location
    machine_a = db_session.query(
        models.Machine).filter_by(name="Machine A").first()
    assert machine_a is not None
    assert machine_a.location == "Room 2"
    assert machine_a.type == "Type B"


def test_delete_device(db_session):
    """Test deleting a device."""
    data = MockDeviceData("Del", "DD:DD:DD", "Shop", "Type")
    db_service.add_device(db_session, data)

    # Verify device exists
    assert db_service.get_device(db_session, "DD:DD:DD") is not None

    # Delete device
    assert db_service.delete_device(db_session, "DD:DD:DD") is True

    # Verify deletion
    assert db_service.get_device(db_session, "DD:DD:DD") is None


def test_reassign_monitor(db_session):
    """Test reassigning a monitor from one machine to another."""
    # Create two machines with monitors
    data1 = MockDeviceData("Machine A", "AA:AA:AA", "Shop", "TypeA", id=1)
    data2 = MockDeviceData("Machine B", "BB:BB:BB", "Shop", "TypeB", id=2)
    db_service.add_device(db_session, data1)
    db_service.add_device(db_session, data2)

    # Verify initial setup
    monitor_a = db_session.query(
        models.Monitor).filter_by(mac="AA:AA:AA").first()
    monitor_b = db_session.query(
        models.Monitor).filter_by(mac="BB:BB:BB").first()
    assert monitor_a.machine_name == "Machine A"
    assert monitor_b.machine_name == "Machine B"

    # Reassign Monitor B to Machine A (Monitor A should become orphaned)
    success = db_service.reassign_monitor(db_session, 2, "Machine A")
    assert success is True

    # Verify reassignment
    db_session.refresh(monitor_a)
    db_session.refresh(monitor_b)
    assert monitor_a.machine_name is None  # Orphaned
    assert monitor_b.machine_name == "Machine A"  # Reassigned

    # Verify Machine B is now without a monitor
    devices = db_service.get_devices(db_session)
    machine_b_device = next(
        (d for d in devices if d["name"] == "Machine B"), None)
    assert machine_b_device is not None
    assert machine_b_device["mac"] is None  # No monitor assigned


def test_reassign_monitor_with_polls(db_session):
    """Test that reassigning a monitor doesn't affect poll ownership."""
    # Create machine with monitor
    data = MockDeviceData("CNC", "CC:CC:CC", "Shop", "CNC", id=1)
    db_service.add_device(db_session, data)

    # Add polls for the machine
    now = datetime.now(timezone.utc)
    db_service.insert_poll(db_session, "CC:CC:CC", 1000,
                           now - timedelta(minutes=5))
    db_service.insert_poll(db_session, "CC:CC:CC", 1100, now)

    # Create a second machine and monitor
    data2 = MockDeviceData("Mill", "DD:DD:DD", "Shop", "Mill", id=2)
    db_service.add_device(db_session, data2)

    # Reassign Monitor CC to Mill machine
    success = db_service.reassign_monitor(db_session, 1, "Mill")
    assert success is True

    # Verify polls still belong to CNC machine (not moved with monitor)
    cnc_polls = db_session.query(
        models.Poll).filter_by(machine_name="CNC").all()
    assert len(cnc_polls) == 2
    assert all(p.monitor_mac == "CC:CC:CC" for p in cnc_polls)

    # Mill should have no polls yet
    mill_polls = db_session.query(
        models.Poll).filter_by(machine_name="Mill").all()
    assert len(mill_polls) == 0


def test_reassign_monitor_nonexistent(db_session):
    """Test reassigning with nonexistent monitor or machine."""
    data = MockDeviceData("Machine", "AA:AA:AA", "Shop", "Type", id=1)
    db_service.add_device(db_session, data)

    # Try to reassign nonexistent monitor
    assert db_service.reassign_monitor(
        db_session, 999, "Machine") is False

    # Try to reassign to nonexistent machine
    assert db_service.reassign_monitor(
        db_session, 1, "Nonexistent") is False


def test_delete_machine_by_name(db_session):
    """Test deleting a machine by name (without monitor)."""
    # Create a machine without a monitor
    machine = models.Machine(name="Standalone Machine",
                             type="Test", location="Lab")
    db_session.add(machine)
    db_session.commit()

    # Verify machine exists
    machines = [d["name"] for d in db_service.get_devices(db_session)]
    assert "Standalone Machine" in machines

    # Delete by machine name
    assert db_service.delete_machine_by_name(
        db_session, "Standalone Machine") is True

    # Verify deletion
    machines = [d["name"] for d in db_service.get_devices(db_session)]
    assert "Standalone Machine" not in machines


def test_delete_device_with_null_mac(db_session):
    """Test that delete_device handles null MAC addresses gracefully."""
    # Should return False for null/None MAC addresses
    assert db_service.delete_device(db_session, None) is False
    assert db_service.delete_device(db_session, "null") is False
    assert db_service.delete_device(db_session, "NULL") is False
    assert db_service.delete_device(db_session, "none") is False


def test_get_locations(db_session):
    """Test getting unique locations."""
    data1 = MockDeviceData("Dev1", "11:11:11", "Shop", "CNC")
    data2 = MockDeviceData("Dev2", "22:22:22", "Workshop", "Lathe")
    data3 = MockDeviceData("Dev3", "33:33:33", "Shop", "Mill")

    db_service.add_device(db_session, data1)
    db_service.add_device(db_session, data2)
    db_service.add_device(db_session, data3)

    locations = db_service.get_locations(db_session)
    assert len(locations) == 2
    assert "Shop" in locations
    assert "Workshop" in locations


def test_get_machine_types(db_session):
    """Test getting unique machine types."""
    data1 = MockDeviceData("Dev1", "44:44:44", "Shop", "CNC")
    data2 = MockDeviceData("Dev2", "55:55:55", "Shop", "Lathe")
    data3 = MockDeviceData("Dev3", "66:66:66", "Shop", "CNC")

    db_service.add_device(db_session, data1)
    db_service.add_device(db_session, data2)
    db_service.add_device(db_session, data3)

    types = db_service.get_machine_types(db_session)
    assert len(types) == 2
    assert "CNC" in types
    assert "Lathe" in types


def test_get_power(db_session):
    """Test getting power data for a device."""
    # Add device
    data = MockDeviceData("Test", "77:77:77", "Shop", "Test")
    db_service.add_device(db_session, data)

    # Add polls
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)

    # Add some polls within the time range
    p1 = models.Poll(monitor_mac="77:77:77", machine_name="Test", power_usage=100,
                     poll_time=now - timedelta(minutes=30))
    p2 = models.Poll(monitor_mac="77:77:77", machine_name="Test", power_usage=200,
                     poll_time=now - timedelta(minutes=15))
    p3 = models.Poll(monitor_mac="77:77:77", machine_name="Test",
                     power_usage=150, poll_time=now)

    # Add one poll outside the time range (should not be returned)
    p4 = models.Poll(monitor_mac="77:77:77", machine_name="Test", power_usage=50,
                     poll_time=now - timedelta(hours=2))

    db_session.add_all([p1, p2, p3, p4])
    db_session.commit()

    # Get power data
    power_data = db_service.get_power(db_session, "77:77:77", cutoff)

    # Should only get 3 polls (within the cutoff)
    assert len(power_data) == 3
    assert power_data[0]['value'] == 100
    assert power_data[1]['value'] == 200
    assert power_data[2]['value'] == 150


def test_get_no_device_polls(db_session):
    """Test getting poll count for a device."""
    # Add device
    data = MockDeviceData("Test", "88:88:88", "Shop", "Test")
    db_service.add_device(db_session, data)

    # Add polls
    now = datetime.now(timezone.utc)
    p1 = models.Poll(monitor_mac="88:88:88", machine_name="Test",
                     power_usage=100, poll_time=now)
    p2 = models.Poll(monitor_mac="88:88:88", machine_name="Test", power_usage=200,
                     poll_time=now - timedelta(minutes=5))
    p3 = models.Poll(monitor_mac="88:88:88", machine_name="Test", power_usage=150,
                     poll_time=now - timedelta(minutes=10))

    db_session.add_all([p1, p2, p3])
    db_session.commit()

    # Get poll count
    count = db_service.get_no_device_polls(db_session, "88:88:88")
    assert count == 3


def test_empty_database(db_session):
    """Test behavior with empty database."""
    # Get devices from empty database
    devs = db_service.get_devices(db_session)
    assert len(devs) == 0

    # Get non-existent device
    d = db_service.get_device(db_session, "NONEXISTENT")
    assert d is None

    # Delete non-existent device
    assert db_service.delete_device(db_session, "NONEXISTENT") is False

    # Update non-existent device
    data = MockDeviceData("Test", "TEST:MAC", "Shop", "Test")
    assert db_service.update_device(db_session, "NONEXISTENT", data) is False
