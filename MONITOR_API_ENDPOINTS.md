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
