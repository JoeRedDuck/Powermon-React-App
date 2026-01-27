#!/usr/bin/env python3
"""Test the POST /api/v1/monitors endpoint"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_create_monitor():
    """Test creating a new monitor"""
    print("\n=== Test 1: Create new monitor (unassigned) ===")
    response = requests.post(
        f"{BASE_URL}/api/v1/monitors",
        json={
            "id": 999,
            "mac": "FF:FF:FF:FF:FF:FF",
            "machine_name": None
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"
    
def test_create_monitor_with_machine():
    """Test creating a monitor assigned to a machine"""
    print("\n=== Test 2: Create monitor assigned to Pump 1 ===")
    response = requests.post(
        f"{BASE_URL}/api/v1/monitors",
        json={
            "id": 998,
            "mac": "EE:EE:EE:EE:EE:EE",
            "machine_name": "Pump 1"
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 201, f"Expected 201, got {response.status_code}"

def test_duplicate_id():
    """Test that duplicate ID is rejected"""
    print("\n=== Test 3: Try to create duplicate ID ===")
    response = requests.post(
        f"{BASE_URL}/api/v1/monitors",
        json={
            "id": 1,  # Already exists (Pump 1)
            "mac": "DD:DD:DD:DD:DD:DD",
            "machine_name": None
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"

def test_duplicate_mac():
    """Test that duplicate MAC is rejected"""
    print("\n=== Test 4: Try to create duplicate MAC ===")
    response = requests.post(
        f"{BASE_URL}/api/v1/monitors",
        json={
            "id": 997,
            "mac": "C8:C9:A3:1A:F2:DB",  # Already exists (Pump 1)
            "machine_name": None
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"

def test_nonexistent_machine():
    """Test that assigning to nonexistent machine is rejected"""
    print("\n=== Test 5: Try to assign to nonexistent machine ===")
    response = requests.post(
        f"{BASE_URL}/api/v1/monitors",
        json={
            "id": 996,
            "mac": "CC:CC:CC:CC:CC:CC",
            "machine_name": "Nonexistent Machine"
        }
    )
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
    assert response.status_code == 400, f"Expected 400, got {response.status_code}"

def test_list_monitors():
    """List all monitors to verify"""
    print("\n=== Test 6: List all monitors ===")
    response = requests.get(f"{BASE_URL}/api/v1/monitors")
    monitors = response.json()
    print(f"Total monitors: {len(monitors)}")
    for m in monitors:
        if m['id'] in [999, 998]:
            print(f"  Monitor {m['id']}: MAC={m['mac']}, Machine={m['name']}")

if __name__ == "__main__":
    try:
        test_create_monitor()
        test_create_monitor_with_machine()
        test_duplicate_id()
        test_duplicate_mac()
        test_nonexistent_machine()
        test_list_monitors()
        print("\n✅ All tests passed!")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
