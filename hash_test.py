import os
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_change_me")
RESET_SALT = "password-reset"
ph = PasswordHasher()
serializer = URLSafeTimedSerializer(SECRET_KEY)


def hash_password(password: str) -> str:
    """Hash a plain password using Argon2."""
    return ph.hash(password)


def verify_password(hash_value: str, password: str) -> bool:
    """Verify a plain password against an Argon2 hash.

    Returns True if password matches, False otherwise.
    """
    try:
        return ph.verify(hash_value, password)
    except VerifyMismatchError:
        return False


def make_reset_token(email: str) -> str:
    """Return a time-safe reset token for the given email."""
    return serializer.dumps(email, salt=RESET_SALT)


def verify_reset_token(token: str, max_age: int = 3600) -> str | None:
    """Return the email if token is valid and not expired, otherwise None."""
    try:
        return serializer.loads(token, salt=RESET_SALT, max_age=max_age)
    except SignatureExpired:
        return None
    except BadSignature:
        return None


if __name__ == "__main__":
    # Demo flow
    user_password = "na18mjx87T"
    hashed_password = hash_password(user_password)
    print("Hashed password:", hashed_password)

    input_password = input("Enter your password: ")
    if verify_password(hashed_password, input_password):
        print("Password is correct!")
    else:
        print("Password is incorrect!")

    # Reset token demo
    token = make_reset_token("alice@example.com")
    print("Reset token (valid for 1h):", token)
    print("Token verifies to:", verify_reset_token(token, max_age=3600))
