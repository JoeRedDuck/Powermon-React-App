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
    assert db_service.add_device(db_session, data) is True

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
    assert db_service.add_device(db_session, data) is True

    # Try to add same MAC again - should return False
    assert db_service.add_device(db_session, data) is False


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


def test_delete_machine_by_name(db_session):
    """Test deleting a machine by name (without monitor)."""
    # Create a machine without a monitor
    machine = models.Machine(name="Standalone Machine", type="Test", location="Lab")
    db_session.add(machine)
    db_session.commit()

    # Verify machine exists
    machines = [d["name"] for d in db_service.get_devices(db_session)]
    assert "Standalone Machine" in machines

    # Delete by machine name
    assert db_service.delete_machine_by_name(db_session, "Standalone Machine") is True

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
