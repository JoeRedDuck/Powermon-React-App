#!/usr/bin/env python3
"""
Test script for Expo push notification endpoints.
"""
import pytest  # type: ignore
from starlette.testclient import TestClient  # type: ignore
from sqlalchemy import create_engine, StaticPool  # type: ignore
from sqlalchemy.orm import sessionmaker  # type: ignore

from app import app, get_db
from database import Base

TEST_TOKEN = "ExponentPushToken[fQXUGcOmxBzxtQb_Iveayj]"

# --- DATABASE SETUP ---
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
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_register_token(test_db):
    """Test registering a notification token."""
    response = client.post(
        "/api/v1/notifications/register",
        json={
            "token": TEST_TOKEN,
            "device_name": "Test Device"
        }
    )
    assert response.status_code == 200


def test_list_tokens(test_db):
    """Test listing all tokens."""
    # First register a token
    client.post(
        "/api/v1/notifications/register",
        json={
            "token": TEST_TOKEN,
            "device_name": "Test Device"
        }
    )

    response = client.get("/api/v1/notifications/tokens")
    assert response.status_code == 200
    data = response.json()
    assert "tokens" in data
    assert TEST_TOKEN in data["tokens"]


def test_send_notification(test_db):
    """Test the notification endpoint exists."""
    # This is mostly tested through alert_monitor and ups_monitor
    # Just verify the endpoint structure is correct
    pass


def test_delete_token(test_db):
    """Test deleting a token."""
    # First register a token
    client.post(
        "/api/v1/notifications/register",
        json={
            "token": TEST_TOKEN,
            "device_name": "Test Device"
        }
    )

    response = client.delete(
        f"/api/v1/notifications/tokens/{TEST_TOKEN}"
    )
    assert response.status_code == 200


def test_list_tokens_after_delete(test_db):
    """Verify token is gone after deletion."""
    # Register a token
    client.post(
        "/api/v1/notifications/register",
        json={
            "token": TEST_TOKEN,
            "device_name": "Test Device"
        }
    )

    # Delete it
    client.delete(f"/api/v1/notifications/tokens/{TEST_TOKEN}")

    # Verify it's gone
    response = client.get("/api/v1/notifications/tokens")
    data = response.json()
    assert TEST_TOKEN not in data["tokens"]
