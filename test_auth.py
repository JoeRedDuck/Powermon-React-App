"""Tests for the complete authentication flow.

Every test gets a fresh SQLite in-memory database via the ``_test_db``
autouse fixture in conftest.py.  No monkeypatching of db helpers is needed.
"""
from fastapi.testclient import TestClient
import app

client = TestClient(app.app)

# ── helpers ────────────────────────────────────────────────────────────────

ALICE = {"username": "alice", "email": "alice@example.com", "password": "s3curePass!"}
BOB   = {"username": "bob",   "email": "bob@example.com",   "password": "b0bSecure!"}


def _register(user: dict):
    return client.post("/api/v1/auth/register", json=user)


def _login(username: str, password: str):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


# ── registration ───────────────────────────────────────────────────────────

def test_register_success():
    r = _register(ALICE)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "created"
    assert data["user"]["username"] == "alice"
    assert data["user"]["email"] == "alice@example.com"


def test_register_weak_password():
    r = _register({"username": "weak", "email": "w@e.com", "password": "short"})
    assert r.status_code == 400
    assert "weak_password" in str(r.json())


def test_register_duplicate_username():
    _register(ALICE)
    r = _register({**ALICE, "email": "other@example.com"})
    assert r.status_code == 400
    assert "duplicate" in str(r.json()).lower()


def test_register_duplicate_email():
    _register(ALICE)
    r = _register({**ALICE, "username": "alice2"})
    assert r.status_code == 400
    assert "duplicate" in str(r.json()).lower()


# ── login ──────────────────────────────────────────────────────────────────

def test_login_success():
    _register(ALICE)
    r = _login("alice", "s3curePass!")
    assert r.status_code == 200
    tokens = r.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    assert tokens["token_type"] == "bearer"


def test_login_wrong_password():
    _register(ALICE)
    r = _login("alice", "WRONG")
    assert r.status_code == 401


def test_login_nonexistent_user():
    r = _login("nobody", "whatever1")
    assert r.status_code == 401


# ── refresh ────────────────────────────────────────────────────────────────

def test_refresh_token():
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    refresh_tok = login_r.json()["refresh_token"]

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data


def test_refresh_invalid_token():
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": "bogus"})
    assert r.status_code == 401


# ── me ─────────────────────────────────────────────────────────────────────

def test_me():
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    access = login_r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    me = r.json()
    assert me["username"] == "alice"
    assert me["email"] == "alice@example.com"


def test_me_no_token():
    r = client.get("/api/v1/auth/me")
    assert r.status_code in (401, 403)  # HTTPBearer may return either


def test_me_bad_token():
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


# ── logout ─────────────────────────────────────────────────────────────────

def test_logout():
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    refresh_tok = login_r.json()["refresh_token"]

    r = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_tok})
    assert r.status_code == 200
    assert r.json()["status"] == "logged_out"

    # Using the same refresh token should now fail
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert r2.status_code == 401


# ── forgot / reset password ───────────────────────────────────────────────

def test_forgot_password_existing_user():
    _register(ALICE)
    r = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "reset_code" in data  # returned for testing; production would email


def test_forgot_password_nonexistent_email():
    r = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    # Must NOT reveal whether user exists
    assert "reset_code" not in r.json()


def test_reset_password_flow():
    _register(ALICE)
    forgot_r = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    code = forgot_r.json()["reset_code"]

    r = client.post("/api/v1/auth/reset-password", json={"reset_code": code, "new_password": "newPass123!"})
    assert r.status_code == 200
    assert r.json()["status"] == "ok"

    # Old password should no longer work
    r2 = _login("alice", "s3curePass!")
    assert r2.status_code == 401

    # New password should work
    r3 = _login("alice", "newPass123!")
    assert r3.status_code == 200


def test_reset_password_bad_code():
    r = client.post("/api/v1/auth/reset-password", json={"reset_code": "fake", "new_password": "newPass123!"})
    assert r.status_code == 400


def test_reset_password_weak_new_password():
    _register(ALICE)
    forgot_r = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    code = forgot_r.json()["reset_code"]

    r = client.post("/api/v1/auth/reset-password", json={"reset_code": code, "new_password": "short"})
    assert r.status_code == 400
    assert "weak_password" in str(r.json())


# ── delete account ─────────────────────────────────────────────────────────

def test_delete_account_success():
    """Test successful account deletion."""
    _register(ALICE)
    login_r = _login("alice", ALICE["password"])
    token = login_r.json()["access_token"]
    
    # Delete the account
    r = client.delete("/api/v1/auth/account", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["status"] == "deleted"
    
    # Should not be able to login anymore
    r2 = _login("alice", ALICE["password"])
    assert r2.status_code == 401


def test_delete_account_no_auth():
    """Test that delete account requires authentication."""
    r = client.delete("/api/v1/auth/account")
    assert r.status_code in [401, 403]


def test_delete_account_removes_refresh_tokens():
    """Test that deleting account also removes all refresh tokens."""
    _register(ALICE)
    login_r = _login("alice", ALICE["password"])
    access_token = login_r.json()["access_token"]
    refresh_token = login_r.json()["refresh_token"]
    
    # Delete the account
    r = client.delete("/api/v1/auth/account", headers={"Authorization": f"Bearer {access_token}"})
    assert r.status_code == 200
    
    # Refresh token should no longer work
    r2 = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert r2.status_code == 401
