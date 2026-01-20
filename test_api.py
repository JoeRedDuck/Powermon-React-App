import pytest  # type: ignore
from starlette.testclient import TestClient  # type: ignore
from sqlalchemy import create_engine, StaticPool  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore
from datetime import datetime, timezone

# --- IMPORTS ---
from app import app, get_db
from database import Base
import models

# --- DATABASE SETUP ---
# Use in-memory SQLite with StaticPool so data persists for the duration of the test
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(name="test_db")
def fixture_test_db():
    # Create tables before each test
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop tables after test to ensure clean slate
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(name="client")
def fixture_client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass  # Don't close here as test_db fixture handles it

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as client:
        yield client

    app.dependency_overrides.clear()

# --- HELPER FUNCTIONS ---


def create_dummy_device(client, mac="AA:BB:CC", name="Lathe 1", machine_type="CNC", location="Workshop"):
    return client.post("/api/v1/devices", json={
        "name": name,
        "mac": mac,
        "machine_type": machine_type,
        "location": location
    })

# --- TESTS ---


def test_create_and_list_devices(client):
    """Test creating and retrieving device data."""
    # 1. Create device
    create_res = create_dummy_device(client)
    assert create_res.status_code == 200, f"Creation failed: {create_res.text}"

    response_data = create_res.json()
    assert response_data["status"] == "created"

    # 2. Get List
    response = client.get("/api/v1/devices")
    assert response.status_code == 200

    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Lathe 1"
    assert data[0]["mac"] == "AA:BB:CC"
    assert data[0]["location"] == "Workshop"
    assert data[0]["machine_type"] == "CNC"


def test_get_device_by_mac(client):
    """Test getting a single device by MAC address."""
    mac = "BB:CC:DD"
    create_res = create_dummy_device(client, mac=mac, name="Drill Press")
    assert create_res.status_code == 200

    # Get device by MAC
    response = client.get(f"/api/v1/devices/{mac}")
    assert response.status_code == 200

    device = response.json()
    assert device["mac"] == mac
    assert device["name"] == "Drill Press"
    assert "status" in device


def test_get_device_by_name(client):
    """Test getting a single device by machine name."""
    name = "Drill Press XL"
    mac = "BB:CC:DD"
    create_res = create_dummy_device(
        client, mac=mac, name=name, location="Shop")
    assert create_res.status_code == 200

    # Get device by name
    response = client.get(f"/api/v1/machines/{name}")
    assert response.status_code == 200

    device = response.json()
    assert device["name"] == name
    assert device["mac"] == mac
    assert "status" in device

    # Test nonexistent device
    response = client.get("/api/v1/machines/Nonexistent Machine")
    assert response.status_code == 404


def test_update_device(client):
    """Test updating device information."""
    mac = "CC:DD:EE"
    create_res = create_dummy_device(
        client, mac=mac, name="Mill", location="Shop Floor")
    assert create_res.status_code == 200

    # Update device
    update_res = client.put(f"/api/v1/devices/{mac}", json={
        "name": "Mill",
        "location": "Workshop Area",
        "machine_type": "Mill"
    })
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "updated"

    # Verify update
    response = client.get(f"/api/v1/devices/{mac}")
    device = response.json()
    assert device["location"] == "Workshop Area"


def test_delete_device(client):
    """Test deleting a device."""
    mac = "DD:EE:FF"
    create_res = create_dummy_device(client, mac=mac, name="Temp Device")
    assert create_res.status_code == 200

    # Delete device
    delete_res = client.delete(f"/api/v1/devices/{mac}")
    assert delete_res.status_code == 200
    assert delete_res.json()["status"] == "deleted"

    # Verify deletion
    response = client.get(f"/api/v1/devices/{mac}")
    assert response.status_code == 404


def test_delete_machine_by_name(client, test_db):
    """Test deleting a machine by its name."""
    # Import models here
    import models

    # Create a machine without a monitor
    machine = models.Machine(name="Test Machine", type="Test", location="Lab")
    test_db.add(machine)
    test_db.commit()

    # Verify machine exists in device list
    response = client.get("/api/v1/devices")
    devices = response.json()
    machine_names = [d["name"] for d in devices]
    assert "Test Machine" in machine_names

    # Delete by machine name
    delete_res = client.delete("/api/v1/machines/Test Machine")
    assert delete_res.status_code == 200
    assert delete_res.json()["status"] == "deleted"

    # Verify deletion
    response = client.get("/api/v1/devices")
    devices = response.json()
    machine_names = [d["name"] for d in devices]
    assert "Test Machine" not in machine_names


def test_duplicate_device_prevention(client):
    """Test that duplicate MAC addresses are rejected."""
    mac = "EE:FF:00"
    create_res = create_dummy_device(client, mac=mac, name="Device 1")
    assert create_res.status_code == 200

    # Try to create duplicate
    duplicate_res = create_dummy_device(client, mac=mac, name="Device 2")
    assert duplicate_res.status_code == 400
    assert duplicate_res.json()["detail"]["status"] == "duplicate"


def test_health_endpoint(client):
    """Test the health check endpoint."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_reassign_monitor(client):
    """Test reassigning a monitor from one machine to another."""
    # Create two devices with specific IDs
    create_dummy_device(client, mac="AA:AA:AA",
                        name="Machine A", location="Shop")
    response = client.post("/api/v1/devices", json={
        "name": "Machine B",
        "mac": "BB:BB:BB",
        "machine_type": "CNC",
        "location": "Shop",
        "id": 2
    })
    assert response.status_code == 200

    # Reassign Monitor with ID 2 to Machine A
    response = client.post(
        "/api/v1/monitors/2/reassign?machine_name=Machine A")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "reassigned"
    assert data["monitor_id"] == 2
    assert data["machine_name"] == "Machine A"

    # Verify Machine A now has Monitor with ID 2 (MAC BB:BB:BB)
    devices = client.get("/api/v1/devices").json()
    machine_a = next((d for d in devices if d["name"] == "Machine A"), None)
    assert machine_a is not None
    assert machine_a["mac"] == "BB:BB:BB"
    assert machine_a["id"] == 2

    # Verify Machine B is now without a monitor
    machine_b = next((d for d in devices if d["name"] == "Machine B"), None)
    assert machine_b is not None
    assert machine_b["mac"] is None


def test_reassign_monitor_not_found(client):
    """Test reassigning with nonexistent monitor or machine."""
    response = client.post("/api/v1/devices", json={
        "name": "Machine A",
        "mac": "AA:AA:AA",
        "machine_type": "CNC",
        "location": "Shop",
        "id": 1
    })
    assert response.status_code == 200

    # Try nonexistent monitor
    response = client.post(
        "/api/v1/monitors/999/reassign?machine_name=Machine A")
    assert response.status_code == 404

    # Try nonexistent machine
    response = client.post(
        "/api/v1/monitors/1/reassign?machine_name=Nonexistent")
    assert response.status_code == 404


def test_locations_list(client):
    """Test listing unique locations."""
    create_dummy_device(client, mac="11:11:11", name="Dev1", location="Shop")
    create_dummy_device(client, mac="22:22:22",
                        name="Dev2", location="Workshop")
    create_dummy_device(client, mac="33:33:33", name="Dev3", location="Shop")

    response = client.get("/api/v1/locations")
    assert response.status_code == 200

    locations = response.json()
    assert len(locations) == 2
    assert "Shop" in locations
    assert "Workshop" in locations


def test_machine_types_list(client):
    """Test listing unique machine types."""
    create_dummy_device(client, mac="44:44:44",
                        name="Dev1", machine_type="CNC")
    create_dummy_device(client, mac="55:55:55",
                        name="Dev2", machine_type="Lathe")
    create_dummy_device(client, mac="66:66:66",
                        name="Dev3", machine_type="CNC")

    response = client.get("/api/v1/machine_types")
    assert response.status_code == 200

    types = response.json()
    assert len(types) == 2
    assert "CNC" in types
    assert "Lathe" in types


def test_monitors_list(client):
    """Test listing all monitors."""
    # Create devices with specific IDs
    client.post("/api/v1/devices", json={
        "name": "Machine A",
        "mac": "AA:AA:AA",
        "machine_type": "CNC",
        "location": "Shop",
        "id": 1
    })
    client.post("/api/v1/devices", json={
        "name": "Machine B",
        "mac": "BB:BB:BB",
        "machine_type": "Mill",
        "location": "Shop",
        "id": 2
    })

    response = client.get("/api/v1/monitors")
    assert response.status_code == 200
    monitors = response.json()

    assert len(monitors) == 2
    assert any(m["id"] == 1 and m["mac"] == "AA:AA:AA" and m["name"]
               == "Machine A" for m in monitors)
    assert any(m["id"] == 2 and m["mac"] == "BB:BB:BB" and m["name"]
               == "Machine B" for m in monitors)


def test_device_stats(client):
    """Test device statistics endpoint."""
    create_dummy_device(client, mac="77:77:77", name="Dev1")
    create_dummy_device(client, mac="88:88:88", name="Dev2")

    response = client.get("/api/v1/device_stats")
    assert response.status_code == 200

    stats = response.json()
    assert "offline" in stats
    assert "online" in stats
    assert "no power" in stats
    assert "low power" in stats
    # All devices should be offline (no polls yet)
    assert stats["offline"] == 2


def test_status_endpoint(client):
    """Test status endpoint with filters."""
    create_dummy_device(client, mac="99:99:99", name="Dev1",
                        location="Shop", machine_type="CNC")
    create_dummy_device(client, mac="AA:AA:AA", name="Dev2",
                        location="Workshop", machine_type="Lathe")

    # Test without filters
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    devices = response.json()
    assert len(devices) == 2

    # Test location filter
    response = client.get("/api/v1/status?location=Shop")
    assert response.status_code == 200
    devices = response.json()
    assert len(devices) == 1
    assert devices[0]["location"] == "Shop"

    # Test machine_type filter
    response = client.get("/api/v1/status?machine_type=Lathe")
    assert response.status_code == 200
    devices = response.json()
    assert len(devices) == 1
    assert devices[0]["machine_type"] == "Lathe"

    # Test status filter
    response = client.get("/api/v1/status?status=offline")
    assert response.status_code == 200
    devices = response.json()
    assert len(devices) == 2  # All devices are offline (no polls)


def test_poll_count(client, test_db):
    """Test poll count endpoint."""
    mac = "BB:BB:BB"
    device_name = "Test Device"
    create_dummy_device(client, mac=mac, name=device_name)

    # Add some polls (must include machine_name to match device)
    poll1 = models.Poll(monitor_mac=mac, machine_name=device_name, power_usage=100,
                        poll_time=datetime.now(timezone.utc))
    poll2 = models.Poll(monitor_mac=mac, machine_name=device_name, power_usage=200,
                        poll_time=datetime.now(timezone.utc))
    test_db.add_all([poll1, poll2])
    test_db.commit()

    response = client.post(f"/api/v1/checkPoll/{mac}")
    assert response.status_code == 200
    assert response.json()["count"] == 2


def test_get_nonexistent_device(client):
    """Test getting a device that doesn't exist."""
    response = client.get("/api/v1/devices/NONEXISTENT")
    assert response.status_code == 404
    assert response.json()["detail"]["status"] == "not_found"


def test_update_nonexistent_device(client):
    """Test updating a device that doesn't exist."""
    response = client.put("/api/v1/devices/NONEXISTENT", json={
        "name": "Test",
        "location": "Test",
        "machine_type": "Test"
    })
    assert response.status_code == 404
    assert response.json()["detail"]["status"] == "not_found"
