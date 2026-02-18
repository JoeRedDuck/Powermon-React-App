-- Power Monitoring System Database Schema v3
-- Includes DEFERRABLE foreign key constraints for lock-free machine renames

-- Machine table (primary entity)
CREATE TABLE machine (
    machine_name VARCHAR PRIMARY KEY,
    machine_type VARCHAR NOT NULL,
    location VARCHAR
);

-- Monitor table (hardware devices)
CREATE TABLE monitor (
    monitor_mac_address VARCHAR PRIMARY KEY,
    monitor_id INTEGER UNIQUE NOT NULL,
    type VARCHAR,
    machine_name VARCHAR,
    CONSTRAINT monitor_machine_name_fkey 
        FOREIGN KEY (machine_name) 
        REFERENCES machine(machine_name)
        DEFERRABLE INITIALLY DEFERRED
);

-- Poll table (power usage data)
CREATE TABLE poll (
    poll_number SERIAL PRIMARY KEY,
    poll_time TIMESTAMP NOT NULL,
    power_usage INTEGER NOT NULL,
    machine_name VARCHAR NOT NULL,
    device_mac_address VARCHAR,
    CONSTRAINT poll_machine_name_fkey 
        FOREIGN KEY (machine_name) 
        REFERENCES machine(machine_name)
        ON DELETE CASCADE
        DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT poll_monitor_mac_fkey
        FOREIGN KEY (device_mac_address)
        REFERENCES monitor(monitor_mac_address)
);

-- Notification tokens (Expo push notifications)
CREATE TABLE notification_token (
    id SERIAL PRIMARY KEY,
    token VARCHAR UNIQUE NOT NULL,
    device_name VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Device mute preferences (per-device notification settings)
CREATE TABLE device_mute_preferences (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR UNIQUE NOT NULL,
    muted_machines JSON NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
    CONSTRAINT refresh_tokens_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS poll_machine_idx ON poll (machine_name, poll_time DESC);
CREATE INDEX IF NOT EXISTS poll_monitor_idx ON poll (device_mac_address, poll_time DESC);
CREATE INDEX IF NOT EXISTS device_mute_preferences_device_id_idx ON device_mute_preferences (device_id);
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);

-- Comments explaining key design decisions
COMMENT ON TABLE machine IS 'Primary entity representing physical assets. machine_name is the primary key for stability during monitor swaps.';
COMMENT ON TABLE monitor IS 'Hardware monitoring devices. Can be reassigned between machines. machine_name can be NULL (orphaned monitor).';
COMMENT ON TABLE poll IS 'Power usage measurements. machine_name ensures historical data stays with the asset, not the hardware.';
COMMENT ON CONSTRAINT monitor_machine_name_fkey ON monitor IS 'DEFERRABLE to allow lock-free machine renames using SET CONSTRAINTS DEFERRED';
COMMENT ON CONSTRAINT poll_machine_name_fkey ON poll IS 'DEFERRABLE to allow lock-free machine renames using SET CONSTRAINTS DEFERRED';
