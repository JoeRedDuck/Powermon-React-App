# Machine Rename Fix - Migration Required

## Problem
The API was freezing when trying to rename machines because FK constraints on `monitor` and `poll` tables were not deferrable. This required ALTER TABLE commands that caused exclusive locks and deadlocks.

## Solution
Make the FK constraints DEFERRABLE so we can use `SET CONSTRAINTS DEFERRED` instead of ALTER TABLE.

## Migration Steps (RUN ONCE ON PRODUCTION)

### Option 1: Using psql directly
```bash
# SSH to production server
ssh neil@tapomon

# Run as postgres user
sudo su postgres
psql -d powermon_db3 -f /home/neil/Documents/fastAPI/migrate_fk_deferrable.sql
```

### Option 2: Using apply_migration.sh script
```bash
# SSH to production server
cd /home/neil/Documents/fastAPI

# Edit and run the migration script with correct credentials
export DB_USER=powermon
export DB_PASS=<your_password_here>
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=powermon_db3

./apply_migration.sh
```

## What the migration does
1. Drops `monitor_machine_name_fkey` constraint
2. Recreates it as DEFERRABLE INITIALLY IMMEDIATE
3. Drops `poll_machine_name_fkey` constraint  
4. Recreates it as DEFERRABLE INITIALLY IMMEDIATE with ON DELETE CASCADE

## After migration
- Machine renames will be LOCK-FREE (no ALTER TABLE)
- Uses `SET CONSTRAINTS ... DEFERRED` instead
- No more API freezing
- No more deadlocks

## Verification
After running migration, verify constraints are deferrable:
```sql
SELECT conname, condeferrable, condeferred 
FROM pg_constraint 
WHERE conname IN ('monitor_machine_name_fkey', 'poll_machine_name_fkey');
```

Both should show `condeferrable = true`.

##Fallback
The code automatically detects if constraints are deferrable:
- If YES: Uses fast `SET CONSTRAINTS DEFERRED` path (no locks)
- If NO: Uses slower ALTER TABLE path with 2s timeout (may still cause issues)

## Testing
Run the PostgreSQL test to verify:
```bash
python3 test_pg_machine_rename.py
```
