-- Migration: Make FK constraints deferrable
-- This fixes the lock timeout issue when renaming machines
-- Run with: psql -U powermon -d powermon -f migrations/make_constraints_deferrable.sql

-- Drop existing constraints
ALTER TABLE monitor DROP CONSTRAINT IF EXISTS monitor_machine_name_fkey;
ALTER TABLE poll DROP CONSTRAINT IF EXISTS poll_machine_name_fkey;

-- Recreate as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE monitor 
    ADD CONSTRAINT monitor_machine_name_fkey 
    FOREIGN KEY (machine_name) 
    REFERENCES machine(machine_name) 
    DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE poll 
    ADD CONSTRAINT poll_machine_name_fkey 
    FOREIGN KEY (machine_name) 
    REFERENCES machine(machine_name) 
    ON DELETE CASCADE 
    DEFERRABLE INITIALLY DEFERRED;

-- Verify constraints are deferrable
SELECT conname, condeferrable, condeferred 
FROM pg_constraint 
WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey');
