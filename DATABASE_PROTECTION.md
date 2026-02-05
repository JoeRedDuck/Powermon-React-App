# Database Protection - Summary

## ⚠️ Problem
The `test_pg_machine_rename.py` test was connecting directly to the **production PostgreSQL database**, which meant running `pytest` would modify production data!

## ✅ Solution Implemented

### 1. **Production Database Restored**
Ran `restore_production_db.py` to restore all 7 machines and 7 monitors from `settings.json`:
- Condenser 1-4
- Pump 1-2
- Minus 80

### 2. **Dangerous Test Blocked**
Modified `test_pg_machine_rename.py` to require explicit environment variable:
```python
if not os.getenv('TEST_PRODUCTION_DB') == 'true':
    print("❌ ERROR: This test uses the PRODUCTION database!")
    print("To run this test, set: TEST_PRODUCTION_DB=true")
    sys.exit(1)
```

**To run this test safely:**
```bash
TEST_PRODUCTION_DB=true python3 test_pg_machine_rename.py
```

### 3. **Pytest Configuration**
Updated `pytest.ini` to exclude the dangerous test by default:
```ini
addopts = --ignore=test_pg_machine_rename.py
```

### 4. **Safety Hooks**
Created `conftest.py` with pytest hooks that:
- Warn if production database environment variables are detected
- Block any PostgreSQL connection attempts during normal pytest runs
- Auto-skip dangerous tests unless explicitly enabled

### 5. **Test Database Isolation**
All other tests use **SQLite file-based test databases**:
- `test_optional_mac.db` - Cleaned before each test
- `test_user_scenarios.db` - Cleaned before each test  
- `:memory:` databases for simple tests (test_api.py, test_expo_notifications.py)

### 6. **Added .gitignore**
Created proper `.gitignore` to exclude:
- `__pycache__/` - Python cache files
- `*.db` - Test database files
- IDE and OS files

## Architecture

```
Production System:
├── PostgreSQL Database (protected)
│   └── Only accessed by: app.py, restore_production_db.py
│
Test System:
├── SQLite Test Databases (isolated)
│   ├── test_optional_mac.db
│   ├── test_user_scenarios.db
│   └── :memory: databases
│
Dangerous Test (blocked):
└── test_pg_machine_rename.py
    └── Requires: TEST_PRODUCTION_DB=true
```

## Safety Guarantees

✅ **Running `pytest` will NEVER touch production database**  
✅ **Test databases are separate SQLite files**  
✅ **Production PostgreSQL requires explicit opt-in to test**  
✅ **conftest.py provides multiple layers of protection**  
✅ **Test databases cleaned before each test run**  

## What Changed
- **Before:** `pytest` could modify production PostgreSQL
- **After:** `pytest` only touches isolated SQLite test databases

## Production Database Access
Only these scripts access production PostgreSQL:
1. `app.py` - The actual application (safe)
2. `restore_production_db.py` - Restore from settings.json (safe, intentional)
3. `test_pg_machine_rename.py` - **REQUIRES TEST_PRODUCTION_DB=true flag**

## Test Commands

**Safe (recommended):**
```bash
pytest                          # All unit tests (SQLite only)
pytest test_optional_mac.py     # Specific test file
pytest -v                       # Verbose output
```

**Dangerous (requires explicit flag):**
```bash
TEST_PRODUCTION_DB=true python3 test_pg_machine_rename.py
```

## Files Modified
-  test_optional_mac.py - Uses SQLite test DB
- ✅ test_user_scenarios.py - Uses SQLite test DB
- ✅ test_pg_machine_rename.py - Safety check added
- ✅ pytest.ini - Excludes dangerous test
- ✅ conftest.py - Safety hooks (NEW)
- ✅ .gitignore - Excludes cache/test DBs (NEW)

## Result
**Production database is now fully protected from accidental modification during testing.**
