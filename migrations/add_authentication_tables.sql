-- Migration script to add authentication tables
-- Adds users and refresh_tokens tables for JWT-based authentication

-- Users table for application accounts
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR UNIQUE NOT NULL,
    email VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR DEFAULT 'user',
    reset_code VARCHAR DEFAULT NULL,
    reset_expiry TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens table (server-side stored tokens)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token VARCHAR PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expiry TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT refresh_tokens_user_fkey 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_users_updated_at();

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts for application authentication';
COMMENT ON COLUMN users.username IS 'Unique username for login';
COMMENT ON COLUMN users.email IS 'User email address for password reset';
COMMENT ON COLUMN users.password_hash IS 'Argon2id password hash';
COMMENT ON COLUMN users.is_active IS 'Whether the user account is active';
COMMENT ON COLUMN users.role IS 'User role (e.g., admin, user)';
COMMENT ON COLUMN users.reset_code IS 'Temporary password reset token';
COMMENT ON COLUMN users.reset_expiry IS 'Expiry time for reset token';

COMMENT ON TABLE refresh_tokens IS 'Server-side stored refresh tokens for JWT authentication';
COMMENT ON COLUMN refresh_tokens.token IS 'The refresh token value (primary key)';
COMMENT ON COLUMN refresh_tokens.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN refresh_tokens.expiry IS 'Token expiry timestamp';
