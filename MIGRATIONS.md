# Migration Guide: machine_name in Poll Table

## Overview
The database schema has been updated to add `machine_name` to the `poll` table. This change makes machine identity the **primary tracking mechanism**, decoupling historical power data from specific hardware monitors.

## Key Changes

### 1. Database Schema Changes
- **Added column**: `poll.machine_name` (VARCHAR, Foreign Key to `machine.machine_name`)
- **New index**: `poll_machine_idx` on `(machine_name, poll_time DESC)` for optimal query performance
- **Backward compatibility**: `device_mac_address` column and index retained

### 2. Model Changes ([models.py](models.py))
```python
class Poll(Base):
    machine_name = Column(String, ForeignKey("machine.machine_name"))  # NEW
    monitor_mac = Column("device_mac_address", String, ForeignKey(...))
    
    machine = relationship("Machine")  # NEW
    monitor = relationship("Monitor", back_populates="polls")
```

### 3. Query Logic Changes ([db.py](db.py))
All queries now **prioritize machine_name** over monitor_mac:

- **`get_devices()`**: Groups polls by `machine_name` instead of `monitor_mac`
- **`get_power()`**: Queries polls by `machine_name` after looking up the monitor
- **`get_no_device_polls()`**: Counts polls by `machine_name`

### 4. New Helper Function ([db.py](db.py))
```python
db.insert_poll(session, monitor_mac, power_usage, poll_time)
```
Automatically resolves `machine_name` from `monitor_mac` and validates:
- Monitor exists in database
- Monitor has an associated machine
- Machine exists (FK constraint check)

## Behavior Changes

### ✅ What This Fixes
1. **Monitor Swapping**: If you replace a broken monitor on "CNC Machine 1", the historical power data stays with the machine
2. **Accurate Machine History**: Power trends follow the asset, not the hardware
3. **Simplified Alerting**: Alerts are per-machine, not per-monitor

### ⚠️ Important Considerations

#### Foreign Key Constraints
**CRITICAL**: Polls can only be inserted if:
1. The monitor exists in the `monitor` table
2. The monitor has a `machine_name` assigned
3. The machine exists in the `machine` table

**If any of these fail**, the database will reject the insert with a foreign key error.

#### Machine Status Logic
- `last_seen` in device status now represents when the **machine** was last active
- If Monitor A is unplugged and Monitor B (on the same machine) is plugged in, the machine status stays "online"
- This is **intended behavior** but ensure alerting logic accounts for it

## Action Required

### For External Data Collection Scripts

**OLD CODE** (Won't work anymore):
```python
poll = models.Poll(
    monitor_mac="AA:BB:CC",
    power_usage=1500,
    poll_time=datetime.now(timezone.utc)
)
session.add(poll)
session.commit()
```

**NEW CODE** (Option 1 - Use helper function):
```python
import db
from database import SessionLocal

with SessionLocal() as session:
    success = db.insert_poll(
        session,
        monitor_mac="AA:BB:CC",
        power_usage=1500,
        poll_time=datetime.now(timezone.utc)
    )
    if not success:
        print("Error: Monitor not found!")
```

**NEW CODE** (Option 2 - HTTP API):
```python
import requests
from datetime import datetime

response = requests.post("http://your-server/api/v1/polls", json={
    "monitor_mac": "AA:BB:CC",
    "power_usage": 1500,
    "poll_time": datetime.utcnow().isoformat()  # Optional
})

if response.status_code == 201:
    print("Poll inserted successfully")
elif response.status_code == 404:
    print("Monitor not found - register device first")
```

**NEW CODE** (Option 3 - Manual with lookup):
```python
monitor = session.query(models.Monitor).filter(
    models.Monitor.mac == "AA:BB:CC"
).first()

if not monitor or not monitor.machine_name:
    raise ValueError("Monitor not found or not assigned to machine")

poll = models.Poll(
    monitor_mac="AA:BB:CC",
    machine_name=monitor.machine_name,  # REQUIRED
    power_usage=1500,
    poll_time=datetime.now(timezone.utc)
)
session.add(poll)
session.commit()
```

### For Database Setup
Run `setup_db.py` to create the new indexes:
```bash
python setup_db.py
```

Or manually create the index:
```sql
CREATE INDEX IF NOT EXISTS poll_machine_idx 
ON poll (machine_name, poll_time DESC);
```

### For Testing
All tests in `test_db.py` have been updated to include `machine_name` in poll creation.

Run tests to verify:
```bash
pytest test_db.py -v
```

## New API Endpoints

### POST /api/v1/polls
Insert a new poll record with automatic machine_name resolution.

**Request:**
```json
{
  "monitor_mac": "AA:BB:CC:DD:EE:FF",
  "power_usage": 1500,
  "poll_time": "2026-01-12T10:30:00Z"  // Optional, defaults to now
}
```

**Response (Success):**
```json
{
  "status": "created",
  "poll": {
    "monitor_mac": "AA:BB:CC:DD:EE:FF",
    "power_usage": 1500,
    "poll_time": "2026-01-12T10:30:00Z"
  }
}
```

**Response (Monitor Not Found):**
```json
{
  "status": "monitor_not_found",
  "reason": "Monitor AA:BB:CC:DD:EE:FF not found. Register the device first."
}
```

## Rollback Plan

If issues arise, you can temporarily modify queries to use the old logic:

1. Revert `db.py` queries to use `monitor_mac` instead of `machine_name`
2. The `device_mac_address` column and index are still present
3. Data is not lost - both fields are populated

## Files Changed
- ✅ [models.py](models.py) - Added machine_name column and relationships
- ✅ [db.py](db.py) - Updated all queries + added insert_poll()
- ✅ [app.py](app.py) - Added POST /api/v1/polls endpoint
- ✅ [schema_v3.sql](schema_v3.sql) - Includes deferrable FK constraints
- ✅ [setup_db.py](setup_db.py) - Added machine_name index
- ✅ [test_db.py](test_db.py) - Updated all poll creations
- ✅ [test_poll_insertion.py](test_poll_insertion.py) - Comprehensive tests

## Next Steps
1. ✅ Review this guide
2. ⚠️ **CRITICAL**: Update external data collection scripts/services that insert poll data
3. ✅ Run `python setup_db.py` to create database with proper constraints
4. ✅ Run tests: `pytest -v`
5. ✅ Monitor logs for foreign key constraint errors
6. ✅ Verify alerting logic works as expected with machine-based grouping

---

# Authentication Tables Migration

## Tables Added to `schema_v3.sql`

### `users` table
```sql
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
```

### `refresh_tokens` table
```sql
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token VARCHAR PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expiry TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT refresh_tokens_user_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Indexes
```sql
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id);
```

## How to Apply
If you already have an existing database:
```sql
-- Run these SQL statements against your production database
-- They use IF NOT EXISTS so they're safe to re-run
```

Or re-run the full schema:
```bash
python setup_db.py
```

## Dependencies Added
```
argon2-cffi>=21.3.0
PyJWT>=2.8.0
itsdangerous>=2.0.0
```

Install them:
```bash
pip install -r requirements.txt
```

## Environment Variables (set for production)
```bash
JWT_SECRET=<random-64-char-string>
SECRET_KEY=<random-64-char-string>
```

---
# Machine Rename Fix - Included in Schema

## Problem
The API was freezing when trying to rename machines because FK constraints on `monitor` and `poll` tables were not deferrable. This required ALTER TABLE commands that caused exclusive locks and deadlocks.

## Solution
FK constraints are now DEFERRABLE by default in the schema. The code automatically uses `SET CONSTRAINTS DEFERRED` for lock-free machine renames.

## Setup
Simply run `setup_db.py` to create the database with proper constraints:

```bash
python setup_db.py
```

No migration needed - the schema includes deferrable constraints from the start.

## How It Works
- Monitor and poll FK constraints are `DEFERRABLE INITIALLY IMMEDIATE`
- When renaming machines, code uses `SET CONSTRAINTS ... DEFERRED`
- No ALTER TABLE locks - instant, safe renames
- Foreign key checks happen at transaction commit

## Testing
Run the PostgreSQL test to verify:
```bash
python3 test_pg_machine_rename.py
```
