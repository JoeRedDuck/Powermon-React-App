"""
Comprehensive tests for all user scenarios from the bug report.
Tests all device editing and monitor reassignment functionality.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, get_db
from app import app
import models

# Test database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_user_scenarios.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={
                       "check_same_thread": False})
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

    # Setup initial test data matching settings.json
    db = TestingSessionLocal()
    try:
        # Add machines
        machines = [
            models.Machine(name="Condenser 1", type="condenser",
                           location="Production line"),
            models.Machine(name="Condenser 2", type="condenser",
                           location="Production line"),
            models.Machine(name="Pump 1", type="pump",
                           location="Production line"),
            models.Machine(name="Pump 2", type="pump",
                           location="Production line"),
        ]
        db.add_all(machines)

        # Add monitors
        monitors = [
            models.Monitor(mac="A4:CF:12:FD:9D:5E", id=7,
                           machine_name="Condenser 1"),
            models.Monitor(mac="C8:C9:A3:1A:B9:5D", id=5,
                           machine_name="Condenser 2"),
            models.Monitor(mac="C8:C9:A3:1A:F2:DB",
                           id=1, machine_name="Pump 1"),
            models.Monitor(mac="08:3A:8D:FB:58:F5", id=2,
                           machine_name=None),  # Orphaned
        ]
        db.add_all(monitors)
        db.commit()
    finally:
        db.close()

    yield

    # Clean up
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_scenario_1_edit_device_name(client):
    """
    TEST: Device Name can be edited
    Condenser 1 -> Test 1
    Only the machine name is changed
    Expected: Pass
    """
    # Get current device
    response = client.get("/api/v1/devices")
    assert response.status_code == 200
    devices = response.json()
    condenser1 = next((d for d in devices if d["name"] == "Condenser 1"), None)
    assert condenser1 is not None
    mac = condenser1["mac"]

    # Update only the name
    response = client.put(f"/api/v1/devices/{mac}", json={
        "name": "Test 1",
        "location": condenser1["location"],
        "machine_type": condenser1["machine_type"]
    })
    assert response.status_code == 200, f"Failed to update device name: {response.text}"

    # Verify the change
    response = client.get("/api/v1/devices")
    devices = response.json()
    test1 = next((d for d in devices if d["name"] == "Test 1"), None)
    assert test1 is not None, "Device with new name 'Test 1' not found"
    assert test1["mac"] == mac, "MAC address changed (should not)"
    assert test1["location"] == condenser1[
        "location"], "Location changed (should not)"
    assert test1["machine_type"] == condenser1[
        "machine_type"], "Machine type changed (should not)"

    # Verify old name is gone
    old_device = next((d for d in devices if d["name"] == "Condenser 1"), None)
    assert old_device is None, "Old device name still exists"

    print("✓ TEST PASSED: Device name edited successfully")


def test_scenario_2_edit_machine_type(client):
    """
    TEST: Machine Type can be edited
    Condenser -> pump
    Only the machine type is changed
    Expected: Pass
    """
    # Get current device
    response = client.get("/api/v1/devices")
    devices = response.json()
    condenser2 = next((d for d in devices if d["name"] == "Condenser 2"), None)
    assert condenser2 is not None
    mac = condenser2["mac"]

    # Update only the machine type
    response = client.put(f"/api/v1/devices/{mac}", json={
        "name": condenser2["name"],
        "location": condenser2["location"],
        "machine_type": "pump"
    })
    assert response.status_code == 200, f"Failed to update machine type: {response.text}"

    # Verify the change
    response = client.get("/api/v1/devices")
    devices = response.json()
    updated_device = next(
        (d for d in devices if d["name"] == "Condenser 2"), None)
    assert updated_device is not None
    assert updated_device["machine_type"] == "pump", "Machine type not updated"
    assert updated_device["location"] == condenser2[
        "location"], "Location changed (should not)"
    assert updated_device["name"] == condenser2["name"], "Name changed (should not)"

    print("✓ TEST PASSED: Machine type edited successfully")


def test_scenario_3_edit_location(client):
    """
    TEST: Location can be edited
    Production line -> Test
    Only the location is changed
    Expected: Pass
    """
    # Get current device
    response = client.get("/api/v1/devices")
    devices = response.json()
    pump1 = next((d for d in devices if d["name"] == "Pump 1"), None)
    assert pump1 is not None
    mac = pump1["mac"]

    # Update only the location
    response = client.put(f"/api/v1/devices/{mac}", json={
        "name": pump1["name"],
        "location": "Test",
        "machine_type": pump1["machine_type"]
    })
    assert response.status_code == 200, f"Failed to update location: {response.text}"

    # Verify the change
    response = client.get("/api/v1/devices")
    devices = response.json()
    updated_device = next((d for d in devices if d["name"] == "Pump 1"), None)
    assert updated_device is not None
    assert updated_device["location"] == "Test", "Location not updated"
    assert updated_device["name"] == pump1["name"], "Name changed (should not)"
    assert updated_device["machine_type"] == pump1[
        "machine_type"], "Machine type changed (should not)"

    print("✓ TEST PASSED: Location edited successfully")


def test_scenario_4_reassign_monitor_between_devices(client):
    """
    TEST: Monitor can be reassigned from one device to another
    Condenser 2: Monitor 5 -> Monitor 2
    The machine that monitor is taken from will be without a monitor, 
    monitor that is being replaced is orphaned.
    Expected: Pass
    """
    # Initial state check
    response = client.get("/api/v1/monitors")
    monitors = response.json()
    assert any(m["id"] == 5 and m["name"] == "Condenser 2" for m in monitors)

    # Reassign monitor 2 to Condenser 2 (replacing monitor 5)
    response = client.post(
        "/api/v1/monitors/2/reassign?machine_name=Condenser 2")
    assert response.status_code == 200, f"Failed to reassign monitor: {response.text}"
    data = response.json()
    assert data["monitor_id"] == 2
    assert data["machine_name"] == "Condenser 2"

    # Verify the changes
    response = client.get("/api/v1/monitors")
    monitors = response.json()

    # Monitor 2 should now be assigned to Condenser 2
    monitor2 = next((m for m in monitors if m["id"] == 2), None)
    assert monitor2 is not None
    assert monitor2["name"] == "Condenser 2", "Monitor 2 not assigned to Condenser 2"

    # Monitor 5 should now be orphaned (None)
    monitor5 = next((m for m in monitors if m["id"] == 5), None)
    assert monitor5 is not None
    assert monitor5["name"] is None, "Monitor 5 should be orphaned"

    print("✓ TEST PASSED: Monitor reassigned between devices successfully")


def test_scenario_5_orphaned_monitor_replaces_running(client):
    """
    TEST: An orphaned monitor can replace a running monitor
    Condenser 2: Monitor 2 -> Monitor 5
    Machine's monitor is simply replaced with the orphaned one leaving the old one orphaned
    Expected: Pass
    """
    # First make monitor 2 orphaned and assign monitor 5 to Condenser 2
    client.post("/api/v1/monitors/5/reassign?machine_name=Condenser 2")
    client.post("/api/v1/monitors/2/unassign")

    # Verify initial state
    response = client.get("/api/v1/monitors")
    monitors = response.json()
    assert any(m["id"] == 2 and m["name"]
               is None for m in monitors), "Monitor 2 should be orphaned"
    assert any(m["id"] == 5 and m["name"] ==
               "Condenser 2" for m in monitors), "Monitor 5 should be on Condenser 2"

    # Now reassign orphaned monitor 2 to Condenser 2 (replacing monitor 5)
    response = client.post(
        "/api/v1/monitors/2/reassign?machine_name=Condenser 2")
    assert response.status_code == 200, f"Failed to reassign orphaned monitor: {response.text}"

    # Verify the changes
    response = client.get("/api/v1/monitors")
    monitors = response.json()

    # Monitor 2 should now be assigned to Condenser 2
    monitor2 = next((m for m in monitors if m["id"] == 2), None)
    assert monitor2["name"] == "Condenser 2", "Monitor 2 not assigned to Condenser 2"

    # Monitor 5 should now be orphaned
    monitor5 = next((m for m in monitors if m["id"] == 5), None)
    assert monitor5["name"] is None, "Monitor 5 should be orphaned after replacement"

    print("✓ TEST PASSED: Orphaned monitor replaced running monitor successfully")


def test_scenario_6_assign_monitor_to_machine_without_one(client):
    """
    TEST: A machine without a monitor can be assigned a monitor
    Pump 2: No Assigned Monitor -> Monitor 2
    The machine gets assigned the monitor and starts polling using this monitor.
    Expected: Pass
    """
    # Verify Pump 2 exists but has no monitor
    response = client.get("/api/v1/devices")
    devices = response.json()
    pump2 = next((d for d in devices if d["name"] == "Pump 2"), None)
    assert pump2 is not None
    assert pump2["mac"] is None or pump2["id"] is None, "Pump 2 should not have a monitor initially"

    # Assign monitor 2 to Pump 2
    response = client.post("/api/v1/monitors/2/reassign?machine_name=Pump 2")
    assert response.status_code == 200, f"Failed to assign monitor to Pump 2: {response.text}"

    # Verify the assignment
    response = client.get("/api/v1/devices")
    devices = response.json()
    pump2 = next((d for d in devices if d["name"] == "Pump 2"), None)
    assert pump2 is not None
    assert pump2["id"] == 2, "Monitor 2 not assigned to Pump 2"
    assert pump2["mac"] == "08:3A:8D:FB:58:F5", "Incorrect MAC for Monitor 2"

    print("✓ TEST PASSED: Monitor assigned to machine without one successfully")


def test_scenario_7_add_new_machine_with_monitor(client):
    """
    TEST: New Machine can be added
    Test 1, MonitorID 1000
    Test 1 added to device list
    Expected: Pass (was failing)
    """
    # Add new device with monitor ID 1000
    response = client.post("/api/v1/devices", json={
        "name": "Test 1",
        "mac": "AA:BB:CC:DD:EE:FF",
        "id": 1000,
        "machine_type": "test",
        "location": "Lab"
    })
    assert response.status_code == 200, f"Failed to add new device: {response.text}"

    # Verify it was added
    response = client.get("/api/v1/devices")
    devices = response.json()
    test1 = next((d for d in devices if d["name"] == "Test 1"), None)
    assert test1 is not None, "New device 'Test 1' not found"
    assert test1["id"] == 1000, "Monitor ID incorrect"
    assert test1["mac"] == "AA:BB:CC:DD:EE:FF", "MAC address incorrect"
    assert test1["machine_type"] == "test", "Machine type incorrect"
    assert test1["location"] == "Lab", "Location incorrect"

    # Verify monitor was created
    response = client.get("/api/v1/monitors")
    monitors = response.json()
    monitor1000 = next((m for m in monitors if m["id"] == 1000), None)
    assert monitor1000 is not None, "Monitor 1000 not found"
    assert monitor1000["mac"] == "AA:BB:CC:DD:EE:FF", "Monitor MAC incorrect"
    assert monitor1000["name"] == "Test 1", "Monitor not assigned to Test 1"

    print("✓ TEST PASSED: New machine with monitor added successfully")


def test_edit_device_preserves_monitor_assignment(client):
    """
    ADDITIONAL TEST: Editing device fields should not affect monitor assignment
    """
    # Get initial state
    response = client.get("/api/v1/devices")
    devices = response.json()
    condenser1 = next((d for d in devices if d["name"] == "Condenser 1"), None)
    original_monitor_id = condenser1["id"]
    mac = condenser1["mac"]

    # Edit device name and location
    response = client.put(f"/api/v1/devices/{mac}", json={
        "name": "Updated Condenser",
        "location": "New Location",
        "machine_type": condenser1["machine_type"]
    })
    assert response.status_code == 200

    # Verify monitor assignment is preserved
    response = client.get("/api/v1/devices")
    devices = response.json()
    updated = next(
        (d for d in devices if d["name"] == "Updated Condenser"), None)
    assert updated is not None
    assert updated["id"] == original_monitor_id, "Monitor assignment changed during edit"
    assert updated["mac"] == mac, "Monitor MAC changed during edit"

    print("✓ TEST PASSED: Monitor assignment preserved during device edit")


def test_cannot_duplicate_machine_names(client):
    """
    ADDITIONAL TEST: Should not allow duplicate machine names
    """
    response = client.get("/api/v1/devices")
    devices = response.json()
    condenser1 = next((d for d in devices if d["name"] == "Condenser 1"), None)
    condenser2 = next((d for d in devices if d["name"] == "Condenser 2"), None)

    # Try to rename Condenser 2 to Condenser 1 (should fail)
    response = client.put(f"/api/v1/devices/{condenser2['mac']}", json={
        "name": "Condenser 1",
        "location": condenser2["location"],
        "machine_type": condenser2["machine_type"]
    })
    assert response.status_code == 404, "Should not allow duplicate machine names"

    print("✓ TEST PASSED: Duplicate machine names prevented")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
