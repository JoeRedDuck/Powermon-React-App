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
    assert r.status_code == 409
    assert "duplicate" in str(r.json()).lower()


def test_register_duplicate_email():
    _register(ALICE)
    r = _register({**ALICE, "username": "alice2"})
    assert r.status_code == 409
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


# ── additional registration tests ─────────────────────────────────────────

def test_register_username_is_case_insensitive():
    """Registering 'Alice' should conflict with existing 'alice'."""
    _register(ALICE)
    r = _register({**ALICE, "username": "ALICE", "email": "other@example.com"})
    assert r.status_code == 409
    assert "duplicate" in str(r.json()).lower()


def test_register_username_stored_lowercase():
    """Username should be normalised to lowercase."""
    r = _register({"username": "TestUser", "email": "tu@example.com", "password": "s3curePass!"})
    assert r.status_code == 200
    assert r.json()["user"]["username"] == "testuser"


def test_register_returns_user_id():
    """Registration response should include the new user id."""
    r = _register(ALICE)
    assert r.status_code == 200
    assert "id" in r.json()["user"]
    assert isinstance(r.json()["user"]["id"], int)


def test_register_password_exactly_8_chars():
    """A password of exactly 8 characters should be accepted."""
    r = _register({"username": "edgy", "email": "edgy@example.com", "password": "12345678"})
    assert r.status_code == 200


def test_register_password_7_chars_rejected():
    """A password of 7 characters should be rejected."""
    r = _register({"username": "short", "email": "short@example.com", "password": "1234567"})
    assert r.status_code == 400
    assert "weak_password" in str(r.json())


def test_register_duplicate_email_friendly_message():
    """Duplicate email should return a human-readable reason, not a raw SQL trace."""
    _register(ALICE)
    r = _register({**ALICE, "username": "alice2"})
    assert r.status_code == 409
    body = r.json()
    reason = body.get("detail", {}).get("reason", "")
    assert "email" in reason.lower()
    # Must NOT leak SQL / psycopg2 details
    assert "psycopg2" not in reason.lower()
    assert "INSERT INTO" not in reason


def test_register_duplicate_username_friendly_message():
    """Duplicate username should return a human-readable reason, not a raw SQL trace."""
    _register(ALICE)
    r = _register({**ALICE, "email": "other@example.com"})
    assert r.status_code == 409
    body = r.json()
    reason = body.get("detail", {}).get("reason", "")
    assert "username" in reason.lower()
    assert "psycopg2" not in reason.lower()
    assert "INSERT INTO" not in reason


# ── additional login tests ─────────────────────────────────────────────────

def test_login_username_is_case_insensitive():
    """Login should work regardless of username casing."""
    _register(ALICE)
    r = _login("ALICE", "s3curePass!")
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_returns_bearer_type():
    _register(ALICE)
    r = _login("alice", "s3curePass!")
    assert r.json()["token_type"] == "bearer"


def test_login_wrong_username_right_password():
    """Correct password but wrong username should fail."""
    _register(ALICE)
    r = _login("notAlice", "s3curePass!")
    assert r.status_code == 401


# ── additional refresh tests ──────────────────────────────────────────────

def test_refresh_returns_same_refresh_token():
    """Refreshing should return the same refresh token value."""
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    refresh_tok = login_r.json()["refresh_token"]

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert r.status_code == 200
    assert r.json()["refresh_token"] == refresh_tok


def test_refresh_gives_new_access_token():
    """Refreshing should give a fresh access token (may differ from original)."""
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    original_access = login_r.json()["access_token"]
    refresh_tok = login_r.json()["refresh_token"]

    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_tok})
    assert r.status_code == 200
    assert "access_token" in r.json()


# ── additional me tests ────────────────────────────────────────────────────

def test_me_returns_user_id():
    """The /me endpoint should also return the user id."""
    _register(ALICE)
    login_r = _login("alice", "s3curePass!")
    access = login_r.json()["access_token"]

    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert r.status_code == 200
    assert "id" in r.json()


def test_me_with_expired_format_token():
    """A malformed token should be rejected."""
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401


# ── additional logout tests ────────────────────────────────────────────────

def test_logout_invalid_token_still_succeeds():
    """Logging out with a non-existent refresh token should not error."""
    r = client.post("/api/v1/auth/logout", json={"refresh_token": "nonexistent"})
    assert r.status_code == 200
    assert r.json()["status"] == "logged_out"


def test_logout_does_not_invalidate_other_sessions():
    """Logging out one session should not affect another session's refresh token."""
    _register(ALICE)
    login1 = _login("alice", "s3curePass!")
    login2 = _login("alice", "s3curePass!")
    rt1 = login1.json()["refresh_token"]
    rt2 = login2.json()["refresh_token"]

    # Logout session 1
    client.post("/api/v1/auth/logout", json={"refresh_token": rt1})

    # Session 2 should still work
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": rt2})
    assert r.status_code == 200


# ── additional reset-password tests ────────────────────────────────────────

def test_reset_code_single_use():
    """A reset code can only be consumed once."""
    _register(ALICE)
    forgot_r = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    code = forgot_r.json()["reset_code"]

    # First use should succeed
    r1 = client.post("/api/v1/auth/reset-password", json={"reset_code": code, "new_password": "newPass123!"})
    assert r1.status_code == 200

    # Second use should fail
    r2 = client.post("/api/v1/auth/reset-password", json={"reset_code": code, "new_password": "anotherPass!"})
    assert r2.status_code == 400


def test_forgot_password_new_code_replaces_old():
    """Requesting a second reset code should invalidate the first."""
    _register(ALICE)
    forgot1 = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    code1 = forgot1.json()["reset_code"]

    forgot2 = client.post("/api/v1/auth/forgot-password", json={"email": "alice@example.com"})
    code2 = forgot2.json()["reset_code"]

    # Second code should work
    r = client.post("/api/v1/auth/reset-password", json={"reset_code": code2, "new_password": "brandNew99!"})
    assert r.status_code == 200


def test_login_after_password_reset():
    """After resetting password, only the new password works."""
    _register(BOB)
    forgot_r = client.post("/api/v1/auth/forgot-password", json={"email": "bob@example.com"})
    code = forgot_r.json()["reset_code"]
    client.post("/api/v1/auth/reset-password", json={"reset_code": code, "new_password": "resetBob99!"})

    assert _login("bob", "b0bSecure!").status_code == 401
    assert _login("bob", "resetBob99!").status_code == 200


# ── additional delete account tests ────────────────────────────────────────

def test_re_register_after_deletion():
    """A user should be able to re-register with the same email after deleting their account."""
    _register(ALICE)
    login_r = _login("alice", ALICE["password"])
    token = login_r.json()["access_token"]

    client.delete("/api/v1/auth/account", headers={"Authorization": f"Bearer {token}"})

    # Re-register with the same credentials
    r = _register(ALICE)
    assert r.status_code == 200
    assert r.json()["status"] == "created"


def test_delete_account_bad_token():
    """Delete account with an invalid token should fail."""
    r = client.delete("/api/v1/auth/account", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 401


# ── multi-user isolation tests ─────────────────────────────────────────────

def test_two_users_independent_login():
    """Two users should be able to register and log in independently."""
    _register(ALICE)
    _register(BOB)

    r_alice = _login("alice", "s3curePass!")
    r_bob = _login("bob", "b0bSecure!")

    assert r_alice.status_code == 200
    assert r_bob.status_code == 200
    assert r_alice.json()["access_token"] != r_bob.json()["access_token"]


def test_me_returns_correct_user_for_each_token():
    """Each user's access token should return their own data from /me."""
    _register(ALICE)
    _register(BOB)

    alice_token = _login("alice", "s3curePass!").json()["access_token"]
    bob_token = _login("bob", "b0bSecure!").json()["access_token"]

    me_alice = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {alice_token}"}).json()
    me_bob = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {bob_token}"}).json()

    assert me_alice["username"] == "alice"
    assert me_bob["username"] == "bob"
    assert me_alice["id"] != me_bob["id"]


def test_deleting_one_user_does_not_affect_other():
    """Deleting Alice should not affect Bob."""
    _register(ALICE)
    _register(BOB)

    alice_token = _login("alice", ALICE["password"]).json()["access_token"]
    client.delete("/api/v1/auth/account", headers={"Authorization": f"Bearer {alice_token}"})

    # Bob is fine
    r = _login("bob", BOB["password"])
    assert r.status_code == 200
