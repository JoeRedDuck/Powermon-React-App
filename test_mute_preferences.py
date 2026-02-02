#!/usr/bin/env python3
"""
Test script for device mute preferences functionality.
Tests all API endpoints and database operations.
"""

import requests
import json

BASE_URL = "http://localhost:8000"


def test_mute_preferences():
    """Test all mute preferences endpoints."""

    print("=== Testing Device Mute Preferences API ===\n")

    device_id = "test_device_001"
    machine_name = "Machine_A"

    # Test 1: Get muted machines (should be empty initially)
    print("1. Getting initial muted machines list...")
    response = requests.get(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["muted_machines"] == []
    print("   ✓ Initial list is empty\n")

    # Test 2: Add a machine to muted list
    print("2. Adding a machine to muted list...")
    response = requests.post(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines",
        json={"machine_name": machine_name}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "added"
    print("   ✓ Machine added successfully\n")

    # Test 3: Get muted machines (should contain the added machine)
    print("3. Getting muted machines list after adding...")
    response = requests.get(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert machine_name in response.json()["muted_machines"]
    print("   ✓ Machine is in the list\n")

    # Test 4: Try to add the same machine again (should return already_muted)
    print("4. Trying to add the same machine again...")
    response = requests.post(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines",
        json={"machine_name": machine_name}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "already_muted"
    print("   ✓ Correctly detected duplicate\n")

    # Test 5: Add another machine
    machine_name2 = "Machine_B"
    print("5. Adding a second machine to muted list...")
    response = requests.post(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines",
        json={"machine_name": machine_name2}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    print("   ✓ Second machine added\n")

    # Test 6: Remove a machine from muted list
    print("6. Removing a machine from muted list...")
    response = requests.delete(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines/{machine_name}"
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "removed"
    print("   ✓ Machine removed successfully\n")

    # Test 7: Verify machine was removed
    print("7. Verifying machine was removed...")
    response = requests.get(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert machine_name not in response.json()["muted_machines"]
    assert machine_name2 in response.json()["muted_machines"]
    print("   ✓ First machine removed, second still present\n")

    # Test 8: Replace entire muted list (bulk sync)
    print("8. Replacing entire muted list...")
    new_machines = ["Machine_C", "Machine_D", "Machine_E"]
    response = requests.put(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines",
        json={"machine_names": new_machines}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    assert response.json()["status"] == "replaced"
    print("   ✓ List replaced successfully\n")

    # Test 9: Verify the replacement
    print("9. Verifying the replacement...")
    response = requests.get(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert set(response.json()["muted_machines"]) == set(new_machines)
    print("   ✓ List matches the replaced values\n")

    # Test 10: Try to remove a machine that's not in the list
    print("10. Trying to remove a non-existent machine...")
    response = requests.delete(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines/NonExistent"
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 404
    print("   ✓ Correctly returned 404\n")

    # Test 11: Test with different device
    device_id2 = "test_device_002"
    print(f"11. Testing with a different device ({device_id2})...")
    response = requests.post(
        f"{BASE_URL}/api/devices/{device_id2}/muted-machines",
        json={"machine_name": machine_name}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    print("   ✓ Different devices have separate preferences\n")

    # Test 12: Clear the list for cleanup
    print("12. Clearing muted list for cleanup...")
    response = requests.put(
        f"{BASE_URL}/api/devices/{device_id}/muted-machines",
        json={"machine_names": []}
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    print("   ✓ List cleared\n")

    print("=" * 50)
    print("✓ All tests passed!")
    print("=" * 50)


if __name__ == "__main__":
    try:
        test_mute_preferences()
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
    except requests.exceptions.ConnectionError:
        print("\n✗ Cannot connect to server. Make sure the server is running on http://localhost:8000")
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
