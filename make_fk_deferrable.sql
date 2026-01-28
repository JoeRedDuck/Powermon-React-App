-- Make the foreign key constraint on poll table deferrable
-- This allows us to update monitor MAC addresses even when polls reference them

-- First, drop the existing constraint
ALTER TABLE poll DROP CONSTRAINT IF EXISTS poll_device_mac_address_fkey;

-- Recreate it as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE poll 
ADD CONSTRAINT poll_device_mac_address_fkey 
FOREIGN KEY (device_mac_address) 
REFERENCES monitor(monitor_mac_address) 
ON DELETE CASCADE 
DEFERRABLE INITIALLY DEFERRED;
