-- Migration script to make FK constraints DEFERRABLE
-- This allows SET CONSTRAINTS DEFERRED without ALTER TABLE locks

-- Make monitor FK constraint deferrable
ALTER TABLE monitor DROP CONSTRAINT IF EXISTS monitor_machine_name_fkey;
ALTER TABLE monitor ADD CONSTRAINT monitor_machine_name_fkey 
    FOREIGN KEY (machine_name) REFERENCES machine(machine_name) 
    DEFERRABLE INITIALLY IMMEDIATE;

-- Make poll FK constraint deferrable  
ALTER TABLE poll DROP CONSTRAINT IF EXISTS poll_machine_name_fkey;
ALTER TABLE poll ADD CONSTRAINT poll_machine_name_fkey 
    FOREIGN KEY (machine_name) REFERENCES machine(machine_name) 
    ON DELETE CASCADE 
    DEFERRABLE INITIALLY IMMEDIATE;

-- Verify constraints are now deferrable
SELECT conname, condeferrable, condeferred 
FROM pg_constraint 
WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey')
ORDER BY conname;
