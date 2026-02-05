CREATE TABLE IF NOT EXISTS machine (
  machine_name VARCHAR(255) PRIMARY KEY,
  machine_type VARCHAR(255),
  location VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS monitor (
  monitor_mac_address VARCHAR(255) PRIMARY KEY,
  monitor_id INT,
  type VARCHAR(255),
  machine_name VARCHAR(255),
  FOREIGN KEY (machine_name) REFERENCES machine(machine_name)
);

CREATE TABLE IF NOT EXISTS poll (
  poll_number SERIAL PRIMARY KEY,
  poll_time TIMESTAMP(3),
  power_usage INT,
  machine_name VARCHAR(255), 
  device_mac_address VARCHAR(255),
  FOREIGN KEY (machine_name) REFERENCES machine(machine_name) ON DELETE CASCADE,
  FOREIGN KEY (device_mac_address) REFERENCES monitor(monitor_mac_address) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_token (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_mute_preferences (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  muted_machines JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_device_mute_preferences_device_id ON device_mute_preferences(device_id);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_mute_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_device_mute_preferences_updated_at
    BEFORE UPDATE ON device_mute_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_device_mute_preferences_updated_at();
