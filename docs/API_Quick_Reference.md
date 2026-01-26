# API Endpoints Quick Reference - Monitor Management

## Base URL
```
${EXPO_PUBLIC_API_BASE}/api/v1
```

## Monitor Endpoints

### 1. Get All Monitors
```http
GET /api/v1/monitors
```

**Response:**
```json
[
  {
    "id": 1,
    "mac": "C8:C9:A3:1A:F2:DB",
    "name": "Pump 1",
    "machine_name": "Pump 1"
  },
  {
    "id": 2,
    "mac": "AA:BB:CC:DD:EE:FF",
    "name": null,
    "machine_name": null
  }
]
```

---

### 2. Unassign Monitor
```http
POST /api/v1/monitors/{monitor_id}/unassign
Content-Type: application/json
```

**Purpose:** Remove monitor from its assigned machine (keeps monitor in system)

**Example:**
```bash
curl -X POST http://192.168.11.175:8000/api/v1/monitors/5/unassign \
  -H "Content-Type: application/json"
```

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

---

### 3. Delete Monitor Permanently
```http
DELETE /api/v1/monitors/{monitor_id}
Content-Type: application/json
```

**Purpose:** Completely remove monitor from the system

**Example:**
```bash
curl -X DELETE http://192.168.11.175:8000/api/v1/monitors/5 \
  -H "Content-Type: application/json"
```

**Success Response (200):**
```json
{
  "status": "Monitor 5 deleted successfully",
  "monitor_id": 5
}
```

**Error Response (404):**
```json
{
  "detail": "Monitor with id 5 not found"
}
```

---

### 4. Reassign Monitor to Different Machine
```http
POST /api/v1/monitors/{monitor_id}/reassign?machine_name={machine_name}
Content-Type: application/json
```

**Purpose:** Change which machine a monitor is assigned to

**Example:**
```bash
curl -X POST "http://192.168.11.175:8000/api/v1/monitors/5/reassign?machine_name=Pump%203" \
  -H "Content-Type: application/json"
```

**Success Response (200):**
```json
{
  "status": "Monitor 5 reassigned to Pump 3",
  "monitor_id": 5,
  "machine_name": "Pump 3"
}
```

**Error Responses:**

Monitor not found (404):
```json
{
  "detail": "Monitor with id 5 not found"
}
```

Machine not found (400):
```json
{
  "detail": "Machine 'Pump 3' not found"
}
```

---

## Related Device/Machine Endpoints

### Get All Machines
```http
GET /api/v1/machines
```

**Purpose:** Get list of all machines (for populating dropdowns in edit screen)

**Expected Response:**
```json
[
  {
    "name": "Pump 1",
    "mac": "C8:C9:A3:1A:F2:DB",
    "id": 1,
    "machine_type": "Pump",
    "location": "Factory Floor A"
  },
  {
    "name": "Pump 2",
    "mac": null,
    "id": null,
    "machine_type": "Pump",
    "location": "Factory Floor B"
  }
]
```

---

### Get Single Machine
```http
GET /api/v1/machines/{machine_name}
```

**Purpose:** Get details of a specific machine

**Example:**
```bash
curl http://192.168.11.175:8000/api/v1/machines/Pump%201
```

---

## Implementation Status

| Endpoint | Status | Used In |
|----------|--------|---------|
| GET /monitors | ✅ Implemented | manageMonitors.jsx |
| POST /monitors/{id}/unassign | ⚠️ Needs Backend | ManageMonitorCard.jsx |
| DELETE /monitors/{id} | ⚠️ Needs Backend | ManageMonitorCard.jsx |
| POST /monitors/{id}/reassign | ⚠️ Needs Backend | Future editMonitor.jsx |
| GET /machines | ✅ Implemented | Future editMonitor.jsx |

---

## Error Handling Pattern

All endpoints should follow this error response pattern:

```json
{
  "detail": "Human readable error message"
}
```

Or with more details:
```json
{
  "detail": {
    "reason": "Human readable reason",
    "code": "ERROR_CODE",
    "context": {}
  }
}
```

The mobile app handles both formats and extracts the message using:
```javascript
const errorMsg = body?.detail?.reason || body?.detail || body?.message || body?.error;
```

---

## Testing Commands

### Test Unassign
```bash
# Unassign monitor 1
curl -X POST http://192.168.11.175:8000/api/v1/monitors/1/unassign \
  -H "Content-Type: application/json"
```

### Test Delete
```bash
# Delete monitor 1 permanently
curl -X DELETE http://192.168.11.175:8000/api/v1/monitors/1 \
  -H "Content-Type: application/json"
```

### Test Reassign
```bash
# Reassign monitor 1 to "Pump 2"
curl -X POST "http://192.168.11.175:8000/api/v1/monitors/1/reassign?machine_name=Pump%202" \
  -H "Content-Type: application/json"
```

### Test Get All Monitors
```bash
# Get all monitors
curl http://192.168.11.175:8000/api/v1/monitors
```

---

## Backend Implementation Checklist

- [ ] Create POST /monitors/{id}/unassign endpoint
- [ ] Create DELETE /monitors/{id} endpoint  
- [ ] Create POST /monitors/{id}/reassign endpoint
- [ ] Test all endpoints with curl
- [ ] Add proper error handling
- [ ] Add validation for monitor_id exists
- [ ] Add validation for machine_name exists (reassign only)
- [ ] Return proper HTTP status codes
- [ ] Update database transactions appropriately
- [ ] Add logging for debugging

---

## Notes

1. **URL Encoding**: Machine names with spaces must be URL encoded
   - "Pump 3" → "Pump%203"
   - Use JavaScript's `encodeURIComponent()` in the mobile app

2. **Monitor ID vs MAC**: Monitor ID is the primary key, not MAC address
   - Use `monitor.id` for API calls, not `monitor.mac`

3. **Null Handling**: Monitors without assigned machines will have:
   - `name: null` or `machine_name: null`
   - Display as "Unassigned" in the UI

4. **Refresh Strategy**: After any mutation (unassign/delete/reassign):
   - Mobile app automatically refreshes the monitor list
   - Uses callback pattern: `onDelete(monitorId)`
