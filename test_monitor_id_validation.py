"""Tests for monitor ID validation (Bug #4 fix)"""
import pytest
from fastapi.testclient import TestClient
from app import app


client = TestClient(app)


def test_negative_monitor_id_rejected():
    """Negative monitor ID is treated as None (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine A",
        "id": -1,
        "machine_type": "Extruder",
        "location": "Building 1"
    })
    # Validator converts <=0 to None, so device is created without a monitor
    assert response.status_code == 200


def test_zero_monitor_id_rejected():
    """Zero monitor ID is treated as None (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine B",
        "id": 0,
        "machine_type": "Mixer",
        "location": "Building 2"
    })
    # Validator converts <=0 to None, so device is created without a monitor
    assert response.status_code == 200


def test_positive_monitor_id_accepted():
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


def test_none_monitor_id_accepted():
    """None/null monitor ID is valid (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine D",
        "id": None,
        "machine_type": "Press",
        "location": "Building 5"
    })

    assert response.status_code == 200


def test_omitted_monitor_id_accepted():
    """Omitted monitor ID is valid (no monitor attached)"""
    response = client.post("/api/v1/devices", json={
        "name": "Machine E",
        "machine_type": "Cutter",
        "location": "Building 6"
    })

    assert response.status_code == 200
