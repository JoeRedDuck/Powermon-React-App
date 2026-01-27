# Comprehensive Bug Fix Summary

## Session: Complete Code Review and Bug Fixes
**Date:** Code review after initial bug fix (device_data.mac → mac)
**Objective:** Thorough review of all code to identify and fix ALL bugs

---

## Bugs Found and Fixed

### 1. **Critical Query Logic Bug in get_devices()** ❗❗❗
**File:** `db.py` lines 19-27  
**Severity:** Critical  
**Impact:** When multiple monitors were assigned to the same machine, it would return multiple rows for that machine. Machines without monitors wouldn't appear in results.

**Problem:**
```python
# WRONG: Queries from Monitor table first
db.query(models.Monitor, models.Machine, latest_poll)
.outerjoin(models.Monitor, ...)
```

This creates: `SELECT * FROM Monitor LEFT JOIN Machine`, which:
- Returns multiple rows if multiple monitors point to same machine
- Doesn't return machines without monitors

**Fix:**
```python
# CORRECT: Query from Machine table first
db.query(models.Machine, models.Monitor, latest_poll)
.outerjoin(models.Monitor, models.Monitor.machine_name == models.Machine.name)
```

This creates: `SELECT * FROM Machine LEFT JOIN Monitor`, which:
- Returns exactly one row per machine
- Includes machines without monitors (MAC = None)
- Properly shows the assigned monitor for each machine

**Also updated:** The list comprehension to match new query order:
```python
# Changed from: for m, mach, p in results
# Changed to:   for mach, mon, p in results
```

---

### 2. **NULL Comparison Bug in reassign_monitor()** ❗❗
**File:** `db.py` lines 222-228  
**Severity:** High  
**Impact:** When reassigning a monitor to a machine that already has a monitor with `id=None`, the existing monitor would NOT be orphaned, causing duplicate monitors on one machine.

**Problem:**
```python
# WRONG: Doesn't handle NULL IDs properly
existing_monitor = db.query(models.Monitor).filter(
    models.Monitor.machine_name == new_machine_name,
    models.Monitor.id != monitor_id  # NULL != 2 evaluates to NULL in SQL, not TRUE
).first()
```

In SQL, `NULL != 2` returns NULL (unknown), not TRUE, so monitors with `id=None` were never matched by this filter.

**Fix:**
```python
# CORRECT: Compare by MAC address instead of ID
existing_monitors = db.query(models.Monitor).filter(
    models.Monitor.machine_name == new_machine_name
).all()
for existing_monitor in existing_monitors:
    # Skip if this is the monitor we're reassigning (compare by MAC, which is unique)
    if existing_monitor.mac != monitor.mac:
        existing_monitor.machine_name = None
```

MAC addresses are:
- Never NULL (required field)
- Unique (primary constraint)
- Perfect for identity comparison

**Added import:** `or_` to imports (though ended up not using it in final solution)

---

### 3. **Test Isolation Bug in test_user_scenarios.py** ❗
**File:** `test_user_scenarios.py` line 25  
**Severity:** Medium  
**Impact:** When running all tests together, test_user_scenarios tests would fail because the database dependency override was applied globally at module import time, breaking test_api.py and test_db.py fixtures.

**Problem:**
```python
# WRONG: Set at module level (runs during import)
app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function", autouse=True)
def setup_database():
    Base.metadata.drop_all(bind=engine)
    # ...
```

When pytest imports modules:
1. Imports test_api.py
2. Imports test_db.py
3. Imports test_user_scenarios.py → IMMEDIATELY overrides get_db for ALL subsequent tests
4. test_api and test_db tests now use wrong database!

**Fix:**
```python
# CORRECT: Set inside fixture
@pytest.fixture(scope="function", autouse=True)
def setup_database():
    """Reset database before each test."""
    # Override dependency for this test module
    app.dependency_overrides[get_db] = override_get_db
    
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # ...
    yield
    
    # Clean up
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()  # Clear after test
```

Now each test module properly manages its own database override.

---

## Previously Fixed Bugs (Session Start)

### 4. **AttributeError in update_device()** ❗❗❗
**File:** `db.py` line 319 (before fixes)  
**Severity:** Critical (500 error in production)  
**Already Fixed:** Yes

**Problem:** `device_data.mac` doesn't exist - should be `mac` parameter
**Fix:** Changed to `mac` parameter throughout function

### 5. **Orphaned Monitor Handling**
**Already Fixed:** Added check for `if not monitor.machine_name: return False`

### 6. **Field Update Logic**
**Already Fixed:** Changed from `if field:` to `if field is not None:`

### 7. **Parameter Validation in get_power_data**
**Already Fixed:** Added HTTPException before dictionary access

### 8. **MAC Validation Simplification**
**Already Fixed:** Simplified `if not mac` logic

---

## Test Results

### Before Comprehensive Bug Fixes:
- 43 passed, 3 failed
- Failures: test_reassign_monitor, test_scenario_7, test_edit_device_preserves

### After Fixing Bugs 1-3:
- **46 passed, 0 failed** ✅
- All test_api.py tests pass
- All test_db.py tests pass  
- All test_user_scenarios.py tests pass

---

## Root Cause Analysis

### Bug #1 (Query Logic):
- **Root Cause:** Incorrect understanding of SQLAlchemy query direction
- **Why It Happened:** The join was written backwards - starting from Monitor instead of Machine
- **Impact:** Reassigned monitors would appear to "not work" because get_devices() would show old monitor

### Bug #2 (NULL Comparison):
- **Root Cause:** SQL NULL semantics not handled properly
- **Why It Happened:** Python's `!=` operator doesn't translate directly to SQL with NULLs
- **Impact:** Monitors without IDs would accumulate on machines, creating duplicate monitor assignments

### Bug #3 (Test Isolation):
- **Root Cause:** Module-level code executing at import time
- **Why It Happened:** Dependency override placed outside fixture scope
- **Impact:** Tests would interfere with each other, causing intermittent failures

---

## Code Quality Improvements

1. **Better understanding of SQLAlchemy joins:** Always query from the "one" side (Machine) when doing one-to-one/one-to-many relationships
2. **Proper NULL handling:** Use non-nullable unique fields (like MAC) for identity comparisons instead of potentially-NULL IDs
3. **Proper test isolation:** All setup code must be in fixtures, not at module level
4. **Added detailed comments:** Explaining WHY certain patterns are used (e.g., MAC comparison, query direction)

---

## Files Modified

### db.py (3 bugs fixed):
- Fixed get_devices() query direction (lines 19-35)
- Fixed reassign_monitor() NULL comparison (lines 219-229)
- Added `or_` import (line 2)

### test_user_scenarios.py (1 bug fixed):
- Moved dependency override into fixture (lines 30-63)
- Added cleanup of dependency override

---

## Verification

All bugs have been verified fixed with comprehensive test suite:
- ✅ 18 tests in test_api.py
- ✅ 19 tests in test_db.py
- ✅ 9 tests in test_user_scenarios.py
- ✅ Total: 46 tests passing

The codebase is now thoroughly reviewed and all identified bugs have been fixed.
