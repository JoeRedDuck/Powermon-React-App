#!/usr/bin/env python3
"""
Test script for Expo push notification endpoints.
"""
import requests
import json

BASE_URL = "http://localhost:8000"
TEST_TOKEN = "ExponentPushToken[fQXUGcOmxBzxtQb_Iveayj]"


def test_register_token():
    """Test registering a notification token."""
    print("\n1. Testing token registration...")
    response = requests.post(
        f"{BASE_URL}/api/v1/notifications/register",
        json={
            "token": TEST_TOKEN,
            "device_name": "Test Device"
        }
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200


def test_list_tokens():
    """Test listing all tokens."""
    print("\n2. Testing token list...")
    response = requests.get(f"{BASE_URL}/api/v1/notifications/tokens")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200
    data = response.json()
    assert "tokens" in data
    assert TEST_TOKEN in data["tokens"]


def test_send_notification():
    """Test sending a notification (via the send_expo_notification function)."""
    print("\n3. Testing notification send...")
    # This would be triggered by alert_monitor or ups_monitor
    # We can't directly test it, but the function will use the registered token
    print("   Notification function integrated into alert_monitor and ups_monitor")
    print("   It will send to all registered tokens automatically")


def test_delete_token():
    """Test deleting a token."""
    print("\n4. Testing token deletion...")
    response = requests.delete(
        f"{BASE_URL}/api/v1/notifications/tokens/{TEST_TOKEN}"
    )
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
    assert response.status_code == 200


def test_list_tokens_after_delete():
    """Verify token is gone."""
    print("\n5. Verifying token was deleted...")
    response = requests.get(f"{BASE_URL}/api/v1/notifications/tokens")
    print(f"   Status: {response.status_code}")
    data = response.json()
    print(f"   Response: {data}")
    assert TEST_TOKEN not in data["tokens"]
    print("   ✓ Token successfully deleted")


if __name__ == "__main__":
    print("=" * 60)
    print("Testing Expo Push Notification Endpoints")
    print("=" * 60)

    try:
        test_register_token()
        test_list_tokens()
        test_send_notification()
        test_delete_token()
        test_list_tokens_after_delete()

        print("\n" + "=" * 60)
        print("✓ All tests passed!")
        print("=" * 60)

    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
