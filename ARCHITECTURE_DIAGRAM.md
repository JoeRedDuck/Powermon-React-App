# Device Mute Preferences - System Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NOTIFICATION FLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

1. MACHINE ALERT TRIGGERED
   ┌──────────────┐
   │  Machine_A   │  Power issue detected
   │  Machine_B   │  Offline detected
   └──────┬───────┘
          │
          ▼
   ┌─────────────────┐
   │ alert_monitor() │  Collects affected machines: ["Machine_A", "Machine_B"]
   └────────┬────────┘
            │
            ▼
   ┌──────────────────────────┐
   │ send_expo_notification() │  Receives: title, body, machine_names=["Machine_A", "Machine_B"]
   └──────────┬───────────────┘
              │
              ├─────────────────────────────────────┐
              │                                     │
              ▼                                     ▼
   ┌──────────────────────┐           ┌──────────────────────┐
   │ Get all tokens with  │           │ Get all mute prefs   │
   │ their device IDs     │           │ from database        │
   └──────────┬───────────┘           └──────────┬───────────┘
              │                                   │
              └───────────────┬───────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │  For each device:   │
                    │  Check if any       │
                    │  affected machine   │
                    │  is in muted list   │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
         ┌──────────┐   ┌──────────┐  ┌──────────┐
         │ Device A │   │ Device B │  │ Device C │
         │          │   │          │  │          │
         │ Muted:   │   │ Muted:   │  │ Muted:   │
         │ Machine_A│   │ (none)   │  │ Machine_C│
         └─────┬────┘   └─────┬────┘  └─────┬────┘
               │              │             │
               ▼              ▼             ▼
         ⊘ SKIP       ✓ SEND          ✓ SEND
         (has muted   (no muted      (muted M_C,
         Machine_A)   machines)       not M_A/B)


══════════════════════════════════════════════════════════════════════════

2. USER MANAGES PREFERENCES

   ┌─────────────┐
   │ Mobile App  │
   └──────┬──────┘
          │
          │ User toggles mute on Machine_A
          │
          ▼
   ┌────────────────────────────────────┐
   │ POST /api/devices/{id}/muted-machines │
   │ Body: {"machine_name": "Machine_A"}    │
   └──────────┬─────────────────────────┘
              │
              ▼
   ┌────────────────────────┐
   │ Validate machine exists│
   └──────────┬─────────────┘
              │
              ▼
   ┌──────────────────────────────┐
   │ Update device_mute_preferences│
   │ table in database             │
   └──────────┬───────────────────┘
              │
              ▼
   ┌────────────────────────────┐
   │ Return success response    │
   └────────────┬───────────────┘
                │
                ▼
   ┌──────────────────────────┐
   │ Mobile app updates UI    │
   │ Shows "Muted" status     │
   └──────────────────────────┘


══════════════════════════════════════════════════════════════════════════

3. DATABASE STRUCTURE

┌─────────────────────────────────────────────────────────────────────┐
│                    device_mute_preferences                          │
├──────────┬─────────────┬───────────────────┬────────────┬───────────┤
│    id    │  device_id  │  muted_machines   │ created_at │updated_at │
├──────────┼─────────────┼───────────────────┼────────────┼───────────┤
│    1     │ johns_phone │ ["Machine_A"]     │ 2026-02-02 │2026-02-02 │
│    2     │ marys_phone │ ["Machine_B",     │ 2026-02-02 │2026-02-02 │
│          │             │  "Machine_C"]     │            │           │
│    3     │ shop_tablet │ []                │ 2026-02-02 │2026-02-02 │
└──────────┴─────────────┴───────────────────┴────────────┴───────────┘
              ▲
              │ Indexed for fast lookups
              │
              └─ Links to notification_token.device_name


══════════════════════════════════════════════════════════════════════════

4. API ENDPOINTS OVERVIEW

┌──────────────────────────────────────────────────────────────────┐
│                         REST API                                 │
└──────────────────────────────────────────────────────────────────┘

GET /api/devices/{device_id}/muted-machines
  └─> Returns: {"device_id": "...", "muted_machines": [...]}
  └─> Use: Check current muted machines

POST /api/devices/{device_id}/muted-machines
  └─> Body: {"machine_name": "Machine_A"}
  └─> Returns: {"status": "added" | "already_muted"}
  └─> Use: Mute a specific machine

DELETE /api/devices/{device_id}/muted-machines/{machine_name}
  └─> Returns: {"status": "removed"}
  └─> Use: Unmute a specific machine

PUT /api/devices/{device_id}/muted-machines
  └─> Body: {"machine_names": ["Machine_A", "Machine_B"]}
  └─> Returns: {"status": "replaced", "muted_machines": [...]}
  └─> Use: Bulk update (sync from app)


══════════════════════════════════════════════════════════════════════════

5. EXAMPLE SCENARIO

Scenario: Three devices, one machine has a problem

Setup:
  • Device_1 has muted Machine_A
  • Device_2 has no muted machines
  • Device_3 has muted Machine_B

Event: Machine_A goes offline

Result:
  • Device_1: ⊘ No notification (muted Machine_A)
  • Device_2: ✓ Gets notification
  • Device_3: ✓ Gets notification (only muted Machine_B, not Machine_A)

Event: Machine_B has low power

Result:
  • Device_1: ✓ Gets notification (only muted Machine_A, not Machine_B)
  • Device_2: ✓ Gets notification
  • Device_3: ⊘ No notification (muted Machine_B)

Event: Both Machine_A AND Machine_B are offline

Result:
  • Device_1: ⊘ No notification (Machine_A is in the alert)
  • Device_2: ✓ Gets notification
  • Device_3: ⊘ No notification (Machine_B is in the alert)


══════════════════════════════════════════════════════════════════════════

6. CODE FLOW

alert_monitor()                    send_expo_notification()
     │                                      │
     ├─ Detect issues                      ├─ Query tokens + device IDs
     ├─ Collect machine names              ├─ Query mute preferences
     ├─ Build alert message                ├─ For each device:
     └─ Call send_expo_notification()      │   ├─ Check if muted
                   │                        │   ├─ Skip if muted
                   └────────────────────────┘   └─ Send if not muted


══════════════════════════════════════════════════════════════════════════

7. MOBILE UI MOCKUP

┌─────────────────────────────────┐
│  Machines                    ≡  │
├─────────────────────────────────┤
│  ┌───────────────────────────┐  │
│  │ Machine A       [Online]  │  │
│  │ Floor 1                   │  │
│  │ 🔔 Notifications  ◉ ON    │◀─── User can toggle
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Machine B       [Offline] │  │
│  │ Floor 2                   │  │
│  │ 🔕 Notifications  ○ OFF   │◀─── Currently muted
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Machine C       [Online]  │  │
│  │ Floor 1                   │  │
│  │ 🔔 Notifications  ◉ ON    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘

When user toggles OFF:
  → POST /api/devices/{device_id}/muted-machines
  → Machine added to muted list
  → No more notifications for that machine

When user toggles ON:
  → DELETE /api/devices/{device_id}/muted-machines/{machine_name}
  → Machine removed from muted list
  → Notifications resume


══════════════════════════════════════════════════════════════════════════
```

## Key Design Decisions

### 1. Device Identification
- Uses `device_name` from notification token registration
- Same ID used for both push tokens and mute preferences
- Ensures consistency across systems

### 2. Granularity
- Per-device: Each device has independent preferences
- Per-machine: Mute specific machines, not all notifications
- Immediate: Changes take effect on next notification

### 3. Filtering Logic
- "Any match" approach: If ANY muted machine is in the alert, skip device
- Efficient: Single query loads all preferences per notification batch
- Scalable: O(1) lookup per device using dictionary

### 4. Data Storage
- JSON array: Flexible, supports any number of machines
- JSONB: PostgreSQL native, efficient queries
- Indexed: Fast lookups by device_id

### 5. API Design
- RESTful: Standard HTTP methods (GET, POST, DELETE, PUT)
- Idempotent: Safe to retry operations
- Validated: Ensures machines exist before muting
- Bulk-capable: PUT endpoint for syncing multiple machines

## Performance Characteristics

```
Operation                    Complexity    Notes
─────────────────────────────────────────────────────────────
Get muted machines           O(1)          Indexed lookup
Add muted machine            O(1)          Single row update
Remove muted machine         O(n)          Array scan, typically small
Replace muted list           O(1)          Single row update
Notification filtering       O(d×m×n)      d=devices, m=muted, n=affected
                                           Typically: 10×3×2 = 60 ops
```

For typical deployments (< 100 devices), performance is excellent.
For large deployments (> 1000 devices), consider Redis caching.
# Device Mute Preferences - Implementation Summary

## ✅ Implementation Complete!

All components of the device-specific mute preferences system have been successfully implemented.

## 📦 What Was Implemented

### 1. Database Changes ✅
- **New Table:** `device_mute_preferences`
  - `id` (primary key)
  - `device_id` (unique, indexed)
  - `muted_machines` (JSON array)
  - `created_at`, `updated_at` (timestamps)
- **Migration Script:** `migrations/add_device_mute_preferences.sql`
- **Setup Script:** `create_mute_preferences_table.py`

### 2. Database Operations ✅
Added to `db.py`:
- `get_muted_machines(db, device_id)` - Get muted list
- `add_muted_machine(db, device_id, machine_name)` - Add to muted list
- `remove_muted_machine(db, device_id, machine_name)` - Remove from muted list
- `replace_muted_machines(db, device_id, machine_names)` - Bulk replace
- `get_all_mute_preferences(db)` - Get all preferences for filtering
- `get_notification_tokens_with_devices(db)` - Enhanced token retrieval

### 3. Data Models ✅
Added to `models.py`:
- `DeviceMutePreference` - SQLAlchemy model

Added to `app.py`:
- `MutedMachineAdd` - Pydantic model for POST requests
- `MutedMachineReplace` - Pydantic model for PUT requests

### 4. API Endpoints ✅
All endpoints implemented in `app.py`:

| Method | Endpoint | Status |
|--------|----------|--------|
| GET | `/api/devices/{device_id}/muted-machines` | ✅ |
| POST | `/api/devices/{device_id}/muted-machines` | ✅ |
| DELETE | `/api/devices/{device_id}/muted-machines/{machine_name}` | ✅ |
| PUT | `/api/devices/{device_id}/muted-machines` | ✅ |

### 5. Notification Logic ✅
Modified in `app.py`:
- `send_expo_notification()` - Now checks mute preferences per device
- `alert_monitor()` - Passes machine names to notification system
- Per-device filtering based on muted machines

## 🚀 Next Steps

### 1. Create Database Table
```bash
python create_mute_preferences_table.py
```

### 2. Restart Server
```bash
# Stop current server (Ctrl+C)
# Restart with:
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### 3. Run Tests
```bash
python test_mute_preferences.py
```

### 4. Mobile App Integration
Update your mobile app to use the new endpoints. See `MUTE_PREFERENCES_GUIDE.md` for:
- API usage examples
- UI/UX recommendations
- Integration code samples

## 📄 Documentation Files

1. **MUTE_PREFERENCES_GUIDE.md** - Complete implementation guide
   - Architecture overview
   - API documentation
   - Mobile integration guide
   - Testing procedures
   - Troubleshooting tips

2. **test_mute_preferences.py** - Automated test suite
   - Tests all endpoints
   - Validates functionality
   - Provides usage examples

3. **create_mute_preferences_table.py** - Database setup script
   - Creates all necessary tables
   - Can be run multiple times safely

## 🔍 How It Works

### User Flow Example:
1. User opens machine list in mobile app
2. User toggles "Mute" on Machine_A
3. App calls: `POST /api/devices/{device_id}/muted-machines`
4. Server adds Machine_A to this device's muted list
5. When Machine_A has an issue:
   - Server generates alert
   - Checks each device's mute preferences
   - Skips notification for devices that muted Machine_A
   - Sends to all other devices normally

### Key Features:
- ✅ Per-device granularity (each device has its own preferences)
- ✅ Machine-specific muting (mute individual machines, not all)
- ✅ Bulk operations (sync entire muted list at once)
- ✅ Instant effect (changes apply immediately)
- ✅ No impact on other devices (each device independent)

## 🧪 Testing Example

```bash
# Terminal 1: Start server
uvicorn app:app --reload

# Terminal 2: Run tests
python test_mute_preferences.py

# Expected output:
# === Testing Device Mute Preferences API ===
# 1. Getting initial muted machines list...
#    ✓ Initial list is empty
# 2. Adding a machine to muted list...
#    ✓ Machine added successfully
# ...
# ✓ All tests passed!
```

## 📱 Mobile App API Examples

### Get Muted Machines
```javascript
GET /api/devices/johns_phone/muted-machines

Response:
{
  "device_id": "johns_phone",
  "muted_machines": ["Machine_A", "Machine_B"]
}
```

### Mute a Machine
```javascript
POST /api/devices/johns_phone/muted-machines
Body: { "machine_name": "Machine_A" }

Response:
{
  "status": "added",
  "device_id": "johns_phone",
  "machine_name": "Machine_A"
}
```

### Unmute a Machine
```javascript
DELETE /api/devices/johns_phone/muted-machines/Machine_A

Response:
{
  "status": "removed",
  "device_id": "johns_phone",
  "machine_name": "Machine_A"
}
```

### Bulk Update (Sync)
```javascript
PUT /api/devices/johns_phone/muted-machines
Body: { "machine_names": ["Machine_A", "Machine_C"] }

Response:
{
  "status": "replaced",
  "device_id": "johns_phone",
  "muted_machines": ["Machine_A", "Machine_C"]
}
```

## ⚠️ Important Notes

1. **Device ID:** Use the same `device_name` that was registered with the notification token
2. **Machine Names:** Must match exactly (case-sensitive) with machines in database
3. **Validation:** API validates that machines exist before adding to muted list
4. **Backward Compatible:** Old mobile app versions will continue to receive all notifications

## 🎯 Features Delivered

✅ Database table with proper indexing and triggers  
✅ Full CRUD API for mute preferences  
✅ Per-device notification filtering  
✅ Machine name validation  
✅ Bulk sync operations  
✅ Comprehensive tests  
✅ Complete documentation  
✅ Mobile integration examples  

## 📞 Quick Reference

**Get device mutes:**
```bash
curl http://localhost:8000/api/devices/my_device/muted-machines
```

**Add mute:**
```bash
curl -X POST http://localhost:8000/api/devices/my_device/muted-machines \
  -H "Content-Type: application/json" \
  -d '{"machine_name":"Machine_A"}'
```

**Remove mute:**
```bash
curl -X DELETE http://localhost:8000/api/devices/my_device/muted-machines/Machine_A
```

**Replace all:**
```bash
curl -X PUT http://localhost:8000/api/devices/my_device/muted-machines \
  -H "Content-Type: application/json" \
  -d '{"machine_names":["Machine_A","Machine_B"]}'
```

---

**Status:** ✅ Ready for deployment  
**Next Action:** Create database table and restart server  
**Documentation:** See MUTE_PREFERENCES_GUIDE.md for complete details

---

# Device Creation & Deletion API - Recent Fixes (Feb 2026)

## Bug Fix #1: Monitor ID Validation

### Problem
Mobile apps sending `id: 0` as a default value were getting validation errors:
```json
{
  "detail": [{"msg": "Monitor ID must be a positive integer"}]
}
```

### Solution
The validator now treats `id: 0` (or any non-positive value) as "not provided" by converting it to `None`.

**Before:**
```python
@validator('id')
def validate_monitor_id(cls, v):
    if v is not None and v <= 0:
        raise ValueError('Monitor ID must be a positive integer')
    return v
```

**After:**
```python
@validator('id')
def validate_monitor_id(cls, v):
    # Treat 0 or negative as None (not provided)
    if v is not None and v <= 0:
        return None
    return v
```

### Impact
Mobile apps can now use default values without worrying about validation errors:
```json
{
  "name": "Test 1",
  "id": 0,
  "mac": "",
  "machine_type": "Pump",
  "location": "Production line"
}
```
This is automatically normalized to:
```json
{
  "name": "Test 1",
  "id": null,
  "mac": null,
  "machine_type": "Pump",
  "location": "Production line"
}
```

---

## Bug Fix #2: Device Deletion with Null MAC

### Problem
Machines without monitors returned `mac: null` in the device list. When mobile apps tried to delete them using:
```
DELETE /api/v1/devices/null
```
The server returned `200 OK` with `{"status": "not_deleted"}`, making apps think the deletion succeeded when it actually failed.

### Solution
The endpoint now properly validates MAC addresses and returns appropriate HTTP status codes:

**Updated Endpoint:**
```python
@app.delete("/api/v1/devices/{mac}")
def remove_device(mac: str, session: Session = Depends(get_db)):
    # Handle invalid MAC addresses (null, empty, etc.)
    if not mac or mac.lower() == "null" or mac.lower() == "none":
        raise HTTPException(
            status_code=400,
            detail={
                "status": "error",
                "reason": "Invalid MAC address. For machines without monitors, use DELETE /api/v1/machines/{machine_name}"
            }
        )
    
    if db.delete_device(session, mac):
        return {"status": "deleted"}
    else:
        raise HTTPException(
            status_code=404,
            detail={"status": "not_found", "reason": f"Device with MAC {mac} not found"}
        )
```

### Response Codes

| Scenario | HTTP Status | Response |
|----------|-------------|----------|
| Valid MAC, device deleted | 200 OK | `{"status": "deleted"}` |
| Invalid MAC (null/empty) | 400 Bad Request | Error with guidance |
| Valid MAC, device not found | 404 Not Found | Error message |

### Mobile App Integration

```javascript
// Check if device has a MAC before deleting
if (device.mac === null || device.mac === undefined) {
  // Machine without monitor - use machines endpoint
  await DELETE(`/api/v1/machines/${encodeURIComponent(device.name)}`);
} else {
  // Device with monitor - use devices endpoint
  await DELETE(`/api/v1/devices/${encodeURIComponent(device.mac)}`);
}
```

---

## Device Creation API - Three Scenarios

### POST `/api/v1/devices`

The device creation endpoint supports three distinct scenarios:

#### Scenario 1: Create Device with New Monitor (MAC Provided)
```json
POST /api/v1/devices
{
  "name": "Pump 1",
  "mac": "AA:BB:CC:DD:EE:FF",
  "id": 123,
  "machine_type": "Pump",
  "location": "Building 1"
}
```
**Result:** Creates monitor with MAC, creates/updates machine, attaches monitor to machine

#### Scenario 2: Create Device with Existing Monitor (ID Only)
```json
POST /api/v1/devices
{
  "name": "Pump 2",
  "id": 123,
  "machine_type": "Pump",
  "location": "Building 1"
}
```
**Result:** Finds monitor by ID, creates/updates machine, attaches monitor to machine

#### Scenario 3: Create Machine Without Monitor
```json
POST /api/v1/devices
{
  "name": "Pump 3",
  "machine_type": "Pump",
  "location": "Building 1"
}
```
**Result:** Creates machine only (no monitor). Machine name must be unique.

### Field Processing

| Field | Required | Processing |
|-------|----------|------------|
| `name` | ✅ Yes | Machine name (must be unique for Scenario 3) |
| `machine_type` | ✅ Yes | Type of machine |
| `location` | ✅ Yes | Physical location |
| `mac` | ❌ No | Empty string `""` → `null` |
| `id` | ❌ No | `0` or negative → `null` |

### Error Responses

```json
// MAC already exists
{
  "status_code": 400,
  "detail": {
    "status": "error",
    "reason": "Monitor with MAC address 'AA:BB:CC:DD:EE:FF' already exists"
  }
}

// Monitor ID not found
{
  "status_code": 404,
  "detail": {
    "status": "error",
    "reason": "Monitor with ID 123 not found"
  }
}

// Machine name already exists (Scenario 3 only)
{
  "status_code": 400,
  "detail": {
    "status": "error",
    "reason": "Machine 'Pump 3' already exists"
  }
}
```

---

# Monitor Management API Endpoints

## Overview
Three new API endpoints have been implemented for managing monitors in the power monitoring system.

## Endpoints

### 1. Unassign Monitor from Machine
**Route:** `POST /api/v1/monitors/{monitor_id}/unassign`

**Purpose:** Remove a monitor from its assigned machine but keep the monitor in the system

**Path Parameters:**
- `monitor_id` (integer): The ID of the monitor to unassign

**Success Response (200):**
```json
{
  "status": "Monitor 5 unassigned successfully",
  "monitor_id": 5
}
```

**Error Response (404):**
```json
{
  "detail": "Monitor with id 5 not found"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/v1/monitors/5/unassign \
  -H "Content-Type: application/json"
```

---

### 2. Delete Monitor Permanently
**Route:** `DELETE /api/v1/monitors/{monitor_id}`

**Purpose:** Completely remove a monitor from the system

⚠️ **Important:** Monitors with associated poll data cannot be deleted due to foreign key constraints. Use the unassign endpoint instead to preserve historical data.

**Path Parameters:**
- `monitor_id` (integer): The ID of the monitor to delete

**Success Response (200):**
```json
{
  "status": "Monitor 5 deleted successfully",
  "monitor_id": 5
}
```

**Error Responses:**

404 - Monitor not found:
```json
{
  "detail": "Monitor with id 5 not found"
}
```

400 - Cannot delete (has poll data):
```json
{
  "detail": "Cannot delete monitor: It has associated poll data. Unassign the monitor instead to keep historical data."
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8000/api/v1/monitors/5 \
  -H "Content-Type: application/json"
```

---

### 3. Reassign Monitor to Different Machine
**Route:** `POST /api/v1/monitors/{monitor_id}/reassign`

**Purpose:** Change which machine a monitor is assigned to

**Path Parameters:**
- `monitor_id` (integer): The ID of the monitor to reassign

**Query Parameters:**
- `machine_name` (string, required): The name of the machine to assign the monitor to
  - URL encode spaces and special characters (e.g., `Pump%203` for "Pump 3")

**Success Response (200):**
```json
{
  "status": "Monitor 5 reassigned to Pump 3",
  "monitor_id": 5,
  "machine_name": "Pump 3"
}
```

**Error Responses:**

404 - Monitor not found:
```json
{
  "detail": "Monitor with id 5 not found"
}
```

400 - Machine not found:
```json
{
  "detail": "Machine 'Pump 3' not found"
}
```

422 - Missing machine_name parameter:
```json
{
  "detail": [
    {
      "loc": ["query", "machine_name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Example:**
```bash
curl -X POST "http://localhost:8000/api/v1/monitors/5/reassign?machine_name=Pump%203" \
  -H "Content-Type: application/json"
```

---

## Implementation Details

### Database Functions (db.py)
Three functions in `db.py` handle the database operations:

1. `unassign_monitor(db: Session, monitor_id: int) -> bool`
   - Sets the monitor's `machine_name` field to `None`
   - Keeps the monitor record in the database

2. `delete_monitor(db: Session, monitor_id: int) -> bool`
   - Deletes the monitor record from the database
   - Returns `True` if successful, `False` if monitor not found

3. `reassign_monitor(db: Session, monitor_id: int, new_machine_name: str) -> bool`
   - Verifies both monitor and machine exist
   - Orphans any existing monitor on the target machine
   - Updates the monitor's `machine_name` field
   - Polls remain associated with their original machine_name

### API Endpoints (app.py)
Three FastAPI endpoints provide the REST API:

1. `unassign_monitor_endpoint()` - POST /api/v1/monitors/{monitor_id}/unassign
2. `delete_monitor_endpoint()` - DELETE /api/v1/monitors/{monitor_id}
3. `reassign_monitor_endpoint()` - POST /api/v1/monitors/{monitor_id}/reassign

### Error Handling
- All endpoints return appropriate HTTP status codes (200, 400, 404, 422)
- Error messages use the `detail` field format
- URL decoding of `machine_name` is handled automatically by FastAPI
- Comprehensive validation ensures data integrity

### CORS
CORS is already configured in the application to accept requests from any origin:
```python
app.add_middleware(CORSMiddleware, 
    allow_origins=["*"], 
    allow_methods=["*"], 
    allow_headers=["*"])
```

---

## Testing

### Test Results
All endpoints have been tested and verified:

✅ **Unassign Monitor**
- Successfully unassigns a monitor from its machine
- Returns 404 for non-existent monitors

✅ **Delete Monitor**
- Successfully deletes a monitor
- Returns 404 for non-existent monitors

✅ **Reassign Monitor**
- Successfully reassigns monitor to new machine
- Handles URL-encoded machine names with spaces
- Returns 404 for non-existent monitors
- Returns 400 for non-existent machines
- Returns 422 for missing machine_name parameter

### Test Script
A comprehensive test script is available at `/tmp/test_monitor_endpoints.sh`:

```bash
bash /tmp/test_monitor_endpoints.sh
```

### Manual Testing Examples

```bash
# Get all monitors
curl -X GET http://localhost:8000/api/v1/monitors

# Unassign a monitor
curl -X POST http://localhost:8000/api/v1/monitors/1/unassign \
  -H "Content-Type: application/json"

# Delete a monitor
curl -X DELETE http://localhost:8000/api/v1/monitors/1 \
  -H "Content-Type: application/json"

# Reassign a monitor (with URL-encoded space)
curl -X POST "http://localhost:8000/api/v1/monitors/1/reassign?machine_name=Pump%202" \
  -H "Content-Type: application/json"
```

---

## Notes

- Monitor IDs are integers and are the primary key
- Machine names are strings and can contain spaces
- URL encoding is required for special characters in query parameters
- Poll data is not affected by monitor reassignment (polls stay with machine_name)
- Orphaned monitors (machine_name = null) can be reassigned later
- The API is ready for the React Native mobile app to consume
