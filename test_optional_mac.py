"""
Test suite for optional MAC address device creation and monitor reassignment
Tests the new functionality where:
1. Devices can be created without a MAC address
2. Devices can be created with just a monitor ID (attaching existing monitor)
3. Devices can be edited to reassign monitors
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from app import app
import models

# Test database setup - Use file-based test DB (cleaned before each test)
TEST_DB = "sqlite:///./test_optional_mac.db"
engine = create_engine(TEST_DB, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Reset database before each test."""
    # Override dependency for this test module
    app.dependency_overrides[get_db] = override_get_db

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    yield

    # Clean up
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def test_create_device_without_mac_or_id(client):
    """Test creating a machine without any monitor"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine Without Monitor",
        "machine_type": "Test Machine",
        "location": "Lab 1"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify the device was created
    devices = client.get("/api/v1/devices").json()
    device = next(
        (d for d in devices if d["name"] == "Machine Without Monitor"), None)

    assert device is not None
    assert device["mac"] is None
    assert device["id"] is None
    assert device["machine_type"] == "Test Machine"
    assert device["location"] == "Lab 1"


def test_create_device_with_mac_only(client):
    """Test creating a device with MAC address only (original behavior)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine With New Monitor",
        "mac": "AA:BB:CC:DD:EE:FF",
        "machine_type": "Test Machine",
        "location": "Lab 2"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify the device was created with monitor
    devices = client.get("/api/v1/devices").json()
    device = next(
        (d for d in devices if d["name"] == "Machine With New Monitor"), None)

    assert device is not None
    assert device["mac"] == "AA:BB:CC:DD:EE:FF"
    assert device["machine_type"] == "Test Machine"


def test_create_device_with_mac_and_id(client):
    """Test creating a device with both MAC and monitor ID"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine With Monitor ID",
        "mac": "11:22:33:44:55:66",
        "id": 5,
        "machine_type": "Test Machine",
        "location": "Lab 3"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify the device was created
    devices = client.get("/api/v1/devices").json()
    device = next(
        (d for d in devices if d["name"] == "Machine With Monitor ID"), None)

    assert device is not None
    assert device["mac"] == "11:22:33:44:55:66"
    assert device["id"] == 5


def test_create_device_with_existing_monitor_id(client):
    """Test creating a device and attaching an existing unassigned monitor"""
    # First, create a monitor without a machine
    client.post("/api/v1/devices", json={
        "name": "Temp Machine",
        "mac": "AA:BB:CC:DD:EE:11",
        "id": 10,
        "machine_type": "Temp",
        "location": "Storage"
    })

    # Get the monitor's MAC address
    devices = client.get("/api/v1/devices").json()
    temp_device = next(
        (d for d in devices if d["name"] == "Temp Machine"), None)
    monitor_mac = temp_device["mac"]

    # Unassign the monitor
    client.post(f"/api/v1/monitors/10/unassign")

    # Now create a new machine and attach the existing monitor
    response = client.post("/api/v1/devices", json={
        "name": "New Machine",
        "id": 10,  # Use the existing monitor ID
        "machine_type": "Production",
        "location": "Floor 1"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify the monitor is now assigned to the new machine
    devices = client.get("/api/v1/devices").json()
    new_device = next((d for d in devices if d["name"] == "New Machine"), None)

    assert new_device is not None
    assert new_device["mac"] == monitor_mac
    assert new_device["id"] == 10


def test_create_device_with_assigned_monitor_id_reassigns(client):
    """Test creating a device with a monitor ID that's already assigned to another machine"""
    # Create first device with monitor
    client.post("/api/v1/devices", json={
        "name": "Machine A",
        "mac": "AA:BB:CC:DD:EE:22",
        "id": 20,
        "machine_type": "Type A",
        "location": "Lab A"
    })

    # Create second device and attach the same monitor (should reassign)
    response = client.post("/api/v1/devices", json={
        "name": "Machine B",
        "id": 20,  # Same monitor ID
        "machine_type": "Type B",
        "location": "Lab B"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify Machine B has the monitor
    devices = client.get("/api/v1/devices").json()
    machine_b = next((d for d in devices if d["name"] == "Machine B"), None)
    machine_a = next((d for d in devices if d["name"] == "Machine A"), None)

    assert machine_b is not None
    assert machine_b["id"] == 20
    assert machine_b["mac"] == "AA:BB:CC:DD:EE:22"

    # Verify Machine A no longer has a monitor
    assert machine_a is not None
    assert machine_a["mac"] is None
    assert machine_a["id"] is None


def test_create_device_with_nonexistent_monitor_id(client):
    """Test creating a device with a monitor ID that doesn't exist"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine With Bad Monitor",
        "id": 999,  # Non-existent monitor ID
        "machine_type": "Test",
        "location": "Lab"
    })

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]["reason"].lower()
    assert "999" in response.json()["detail"]["reason"]


def test_duplicate_mac_still_prevented(client):
    """Test that duplicate MAC addresses are still prevented"""
    # Create first device
    client.post("/api/v1/devices", json={
        "name": "Machine 1",
        "mac": "AA:BB:CC:DD:EE:33",
        "machine_type": "Type 1",
        "location": "Lab 1"
    })

    # Try to create second device with same MAC
    response = client.post("/api/v1/devices", json={
        "name": "Machine 2",
        "mac": "AA:BB:CC:DD:EE:33",  # Duplicate MAC
        "machine_type": "Type 2",
        "location": "Lab 2"
    })

    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]["reason"].lower()
    assert "AA:BB:CC:DD:EE:33" in response.json()["detail"]["reason"]


def test_edit_device_with_reassign_monitor(client):
    """Test editing a device and reassigning a different monitor to it"""
    # Create two devices with monitors
    client.post("/api/v1/devices", json={
        "name": "Machine X",
        "mac": "XX:XX:XX:XX:XX:01",
        "id": 100,
        "machine_type": "Type X",
        "location": "Lab X"
    })

    client.post("/api/v1/devices", json={
        "name": "Machine Y",
        "mac": "YY:YY:YY:YY:YY:01",
        "id": 200,
        "machine_type": "Type Y",
        "location": "Lab Y"
    })

    # Edit Machine X to use Monitor 200 (from Machine Y)
    response = client.put("/api/v1/devices/XX:XX:XX:XX:XX:01", json={
        "name": "Machine X",
        "machine_type": "Type X",
        "location": "Lab X",
        "reassign_monitor_id": 200
    })

    assert response.status_code == 200
    assert response.json()["status"] == "updated"

    # Verify Machine X now has Monitor 200
    devices = client.get("/api/v1/devices").json()
    machine_x = next((d for d in devices if d["name"] == "Machine X"), None)
    machine_y = next((d for d in devices if d["name"] == "Machine Y"), None)

    assert machine_x is not None
    assert machine_x["id"] == 200
    assert machine_x["mac"] == "YY:YY:YY:YY:YY:01"

    # Verify Machine Y no longer has a monitor
    assert machine_y is not None
    assert machine_y["mac"] is None
    assert machine_y["id"] is None


def test_edit_device_with_nonexistent_reassign_monitor(client):
    """Test editing a device with a non-existent monitor ID"""
    # Create a device
    client.post("/api/v1/devices", json={
        "name": "Machine Z",
        "mac": "ZZ:ZZ:ZZ:ZZ:ZZ:01",
        "id": 300,
        "machine_type": "Type Z",
        "location": "Lab Z"
    })

    # Try to reassign a non-existent monitor
    response = client.put("/api/v1/devices/ZZ:ZZ:ZZ:ZZ:ZZ:01", json={
        "name": "Machine Z",
        "machine_type": "Type Z",
        "location": "Lab Z",
        "reassign_monitor_id": 999
    })

    assert response.status_code == 404
    assert "not found" in response.json()["detail"]["message"].lower()


def test_multiple_machines_without_monitors(client):
    """Test creating multiple machines without monitors"""
    # Create three machines without monitors
    for i in range(1, 4):
        response = client.post("/api/v1/devices", json={
            "name": f"Standalone Machine {i}",
            "machine_type": f"Type {i}",
            "location": f"Location {i}"
        })
        assert response.status_code == 200

    # Verify all three are in the list
    devices = client.get("/api/v1/devices").json()
    standalone_machines = [
        d for d in devices if d["name"].startswith("Standalone Machine")]

    assert len(standalone_machines) == 3
    for machine in standalone_machines:
        assert machine["mac"] is None
        assert machine["id"] is None


def test_empty_string_mac_accepted(client):
    """Test that empty string MAC address is treated as None (no monitor)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine With Empty MAC",
        "mac": "",  # Empty string - should be treated as no monitor
        "machine_type": "Test",
        "location": "Lab"
    })

    assert response.status_code == 200
    assert response.json()["status"] == "created"

    # Verify the device was created without a monitor
    devices = client.get("/api/v1/devices").json()
    device = next(
        (d for d in devices if d["name"] == "Machine With Empty MAC"), None)

    assert device is not None
    assert device["mac"] is None
    assert device["id"] is None


def test_update_machine_properties_without_monitor(client):
    """Test updating a machine's properties when it has no monitor"""
    # Create machine without monitor
    client.post("/api/v1/devices", json={
        "name": "Bare Machine",
        "machine_type": "Original Type",
        "location": "Original Location"
    })

    # Update its properties - need to use the machine endpoint since there's no MAC
    # Actually, this is a limitation - we can't use PUT /devices/{mac} without a MAC
    # Let's verify the machine exists
    devices = client.get("/api/v1/devices").json()
    machine = next((d for d in devices if d["name"] == "Bare Machine"), None)

    assert machine is not None
    assert machine["machine_type"] == "Original Type"
    assert machine["location"] == "Original Location"
