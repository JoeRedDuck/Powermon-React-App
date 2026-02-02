-- Migration script to add device_mute_preferences table
-- This table stores per-device mute preferences for machine notifications

CREATE TABLE IF NOT EXISTS device_mute_preferences (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR NOT NULL UNIQUE,
    muted_machines JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on device_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_mute_preferences_device_id ON device_mute_preferences(device_id);

-- Add trigger to automatically update updated_at timestamp
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

-- Comments for documentation
COMMENT ON TABLE device_mute_preferences IS 'Stores per-device mute preferences for machine notifications';
COMMENT ON COLUMN device_mute_preferences.device_id IS 'Unique identifier for the device (typically the device name or push token)';
COMMENT ON COLUMN device_mute_preferences.muted_machines IS 'JSON array of machine names that should not trigger notifications for this device';
