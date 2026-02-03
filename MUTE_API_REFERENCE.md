# Mute Preferences API Reference

## 1. GET - Fetch Muted Machines List
**Endpoint:** `GET /api/v1/muted-machines`

**Parameters:** 
- `device_id` (query param, required) - Device identifier

**Example Request:**
```bash
curl "http://localhost:8000/api/v1/muted-machines?device_id=samsung/e3qxeea/e3q:16/BP2A.250605.031.A3/S928BXXU4CYI7:user/release-keys-Joe's%20S24%20Ultra-1770112408486"
```

**Response (200):**
```json
{
  "device_id": "samsung/e3qxeea/e3q:16/...",
  "muted_machines": ["Machine_A", "Machine_B"]
}
```

---

## 2. POST - Add Single Machine to Mute List
**Endpoint:** `POST /api/v1/muted-machines`

**Body:**
```json
{
  "device_id": "samsung/e3qxeea/e3q:16/BP2A.250605.031.A3/...",
  "machine_name": "Machine_A"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/muted-machines" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "your_device_id", "machine_name": "Machine_A"}'
```

**Response (200) - Success:**
```json
{
  "status": "added",
  "device_id": "samsung/e3qxeea/...",
  "machine_name": "Machine_A"
}
```

**Response (200) - Already Muted:**
```json
{
  "status": "already_muted",
  "device_id": "samsung/e3qxeea/...",
  "machine_name": "Machine_A"
}
```

**Response (404) - Machine Not Found:**
```json
{
  "detail": {
    "status": "machine_not_found",
    "machine_name": "Machine_A"
  }
}
```

---

## 3. DELETE - Remove Single Machine from Mute List
**Endpoint:** `DELETE /api/v1/muted-machines`

**Parameters:**
- `device_id` (query param, required)
- `machine_name` (query param, required)

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/muted-machines?device_id=your_device_id&machine_name=Machine_A"
```

**Response (200) - Success:**
```json
{
  "status": "removed",
  "device_id": "samsung/e3qxeea/...",
  "machine_name": "Machine_A"
}
```

**Response (404) - Not in Mute List:**
```json
{
  "detail": {
    "status": "not_found",
    "message": "Machine not in muted list"
  }
}
```

---

## 4. PUT - Replace Entire Mute List (Bulk Sync)
**Endpoint:** `PUT /api/v1/muted-machines`

**Body:**
```json
{
  "device_id": "samsung/e3qxeea/e3q:16/BP2A.250605.031.A3/...",
  "machine_names": ["Machine_A", "Machine_B", "Machine_C"]
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/v1/muted-machines" \
  -H "Content-Type: application/json" \
  -d '{"device_id": "your_device_id", "machine_names": ["Machine_A", "Machine_B"]}'
```

**Response (200) - Success:**
```json
{
  "status": "replaced",
  "device_id": "samsung/e3qxeea/...",
  "muted_machines": ["Machine_A", "Machine_B", "Machine_C"]
}
```

**Response (404) - Machine Not Found:**
```json
{
  "detail": {
    "status": "machine_not_found",
    "machine_name": "NonExistent_Machine"
  }
}
```

**Note:** To clear all muted machines, send empty array: `{"device_id": "...", "machine_names": []}`

---

## JavaScript/TypeScript Examples

### GET - Fetch Muted Machines
```javascript
const deviceId = "samsung/e3qxeea/e3q:16/...";
const response = await fetch(
  `/api/v1/muted-machines?device_id=${encodeURIComponent(deviceId)}`
);
const data = await response.json();
console.log(data.muted_machines);
```

### POST - Add Machine
```javascript
const response = await fetch('/api/v1/muted-machines', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: deviceId,
    machine_name: 'Machine_A'
  })
});
const result = await response.json();
console.log(result.status); // "added" or "already_muted"
```

### DELETE - Remove Machine
```javascript
const response = await fetch(
  `/api/v1/muted-machines?device_id=${encodeURIComponent(deviceId)}&machine_name=${encodeURIComponent('Machine_A')}`,
  { method: 'DELETE' }
);
const result = await response.json();
console.log(result.status); // "removed"
```

### PUT - Replace All
```javascript
const response = await fetch('/api/v1/muted-machines', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    device_id: deviceId,
    machine_names: ['Machine_A', 'Machine_B']
  })
});
const result = await response.json();
console.log(result.muted_machines);
```

---

## Key Points

1. **No URL encoding issues** - Device IDs are in body/query params, not the URL path
2. **Idempotent operations** - Adding already-muted machines returns "already_muted" status
3. **Validation** - All machine names are verified to exist before operations
4. **Bulk sync** - PUT endpoint replaces entire list atomically
5. **Per-device isolation** - Each device has its own independent mute preferences
