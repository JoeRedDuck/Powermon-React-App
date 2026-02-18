"""Tests for password hashing (Argon2) and the forgot/reset-password flow.

Uses the ``_test_db`` autouse fixture for a clean in-memory database each test.
"""
from fastapi.testclient import TestClient
import app

client = TestClient(app.app)


# ── Argon2 hashing helpers ─────────────────────────────────────────────────

def test_hash_password_returns_argon2_string():
    h = app.hash_password("testPassword1")
    assert isinstance(h, str)
    assert h.startswith("$argon2")


def test_verify_password_correct():
    h = app.hash_password("goodPassword!")
    assert app.verify_password(h, "goodPassword!") is True


def test_verify_password_wrong():
    h = app.hash_password("goodPassword!")
    assert app.verify_password(h, "badPassword!") is False


def test_verify_password_empty():
    h = app.hash_password("something")
    assert app.verify_password(h, "") is False


# ── itsdangerous reset token helpers ───────────────────────────────────────

def test_serializer_roundtrip():
    """Verify the itsdangerous serializer used for reset codes works."""
    email = "test@example.com"
    token = app.serializer.dumps(email, salt=app.RESET_SALT)
    assert isinstance(token, str)
    recovered = app.serializer.loads(token, salt=app.RESET_SALT, max_age=3600)
    assert recovered == email


# ── forgot + reset via API ─────────────────────────────────────────────────

def test_forgot_and_reset_full_flow():
    # Register a user first
    client.post("/api/v1/auth/register", json={
        "username": "carol",
        "email": "carol@example.com",
        "password": "carolPass1!"
    })

    # Request a reset code
    r = client.post("/api/v1/auth/forgot-password", json={"email": "carol@example.com"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    code = data["reset_code"]

    # Use the code to reset the password
    r2 = client.post("/api/v1/auth/reset-password", json={
        "reset_code": code,
        "new_password": "newCarolPass!"
    })
    assert r2.status_code == 200
    assert r2.json()["status"] == "ok"

    # Old password should fail
    r3 = client.post("/api/v1/auth/login", json={"username": "carol", "password": "carolPass1!"})
    assert r3.status_code == 401

    # New password should succeed
    r4 = client.post("/api/v1/auth/login", json={"username": "carol", "password": "newCarolPass!"})
    assert r4.status_code == 200
    assert "access_token" in r4.json()


def test_reset_code_single_use():
    """A reset code can only be consumed once."""
    client.post("/api/v1/auth/register", json={
        "username": "dan",
        "email": "dan@example.com",
        "password": "danPass123!"
    })
    r = client.post("/api/v1/auth/forgot-password", json={"email": "dan@example.com"})
    code = r.json()["reset_code"]

    # First use succeeds
    r2 = client.post("/api/v1/auth/reset-password", json={
        "reset_code": code,
        "new_password": "newDanPass!"
    })
    assert r2.status_code == 200

    # Second use fails
    r3 = client.post("/api/v1/auth/reset-password", json={
        "reset_code": code,
        "new_password": "anotherPass!"
    })
    assert r3.status_code == 400