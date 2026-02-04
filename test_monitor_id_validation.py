"""
Tests for monitor ID validation (Bug #4 fix)
"""
import pytest
from fastapi.testclient import TestClient
from app import app
from database import engine
from models import Base


@pytest.fixture
def client():
    """Create test client with fresh database"""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return TestClient(app)


def test_negative_monitor_id_rejected(client):
    """Monitor ID cannot be negative"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine A",
        "id": -1,
        "machine_type": "Extruder",
        "location": "Building 1"
    })
    
    assert response.status_code == 422
    error_detail = response.json()["detail"]
    assert any("Monitor ID must be a positive integer" in str(err) for err in error_detail)


def test_zero_monitor_id_rejected(client):
    """Monitor ID cannot be zero"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine B",
        "id": 0,
        "machine_type": "Mixer",
        "location": "Building 2"
    })
    
    assert response.status_code == 422
    error_detail = response.json()["detail"]
    assert any("Monitor ID must be a positive integer" in str(err) for err in error_detail)


def test_positive_monitor_id_accepted(client):
    """Positive monitor IDs are valid (even if monitor doesn't exist yet)"""
    # First create a monitor so we can use its ID
    response = client.post("/api/v1/devices", json={
        "name": "Machine Setup",
        "mac": "AA:BB:CC:DD:EE:FF",
        "id": 123,
        "machine_type": "Blender",
        "location": "Building 3"
    })
    assert response.status_code == 200
    
    # Now use that monitor's ID (123) for another machine
    response = client.post("/api/v1/devices", json={
        "name": "Machine C",
        "id": 123,
        "machine_type": "Mixer",
        "location": "Building 4"
    })
    
    # Should succeed - monitor 123 exists and can be attached
    assert response.status_code == 200


def test_none_monitor_id_accepted(client):
    """None/null monitor ID is valid (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine D",
        "id": None,
        "machine_type": "Press",
        "location": "Building 5"
    })
    
    assert response.status_code == 200


def test_omitted_monitor_id_accepted(client):
    """Omitted monitor ID is valid (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine E",
        "machine_type": "Cutter",
        "location": "Building 6"
    })
    
    assert response.status_code == 200
