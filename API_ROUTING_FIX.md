# API Routing Fix - Mute Preferences

## Problem
The mute preferences API was returning 404 errors when device IDs contained slashes and special characters:
```
GET /devices/samsung/e3qxeea/e3q%3A16/BP2A.250605.031.A3/.../muted-machines
```

Device IDs like `samsung/e3qxeea/e3q:16/BP2A.250605.031.A3/...` were causing routing conflicts because FastAPI was interpreting the slashes as path separators.

## Solution
**Implemented Option 2**: Changed API route structure to avoid device IDs in the path. Device IDs are now passed as query parameters or in the request body.

## API Changes

### Before (Path-based)
```
GET    /api/devices/{device_id}/muted-machines
POST   /api/devices/{device_id}/muted-machines
DELETE /api/devices/{device_id}/muted-machines/{machine_name}
PUT    /api/devices/{device_id}/muted-machines
```

### After (Body/Query-based)
```
GET    /api/v1/muted-machines?device_id={device_id}
POST   /api/v1/muted-machines              Body: {device_id, machine_name}
DELETE /api/v1/muted-machines?device_id={device_id}&machine_name={name}
PUT    /api/v1/muted-machines              Body: {device_id, machine_names[]}
```

## Model Changes

### MutedMachineAdd
**Before:**
```python
class MutedMachineAdd(BaseModel):
    machine_name: str
```

**After:**
```python
class MutedMachineAdd(BaseModel):
    device_id: str
    machine_name: str
```

### MutedMachineReplace
**Before:**
```python
class MutedMachineReplace(BaseModel):
    machine_names: List[str]
    mac: str
    machine_name: Optional[str] = None
```

**After:**
```python
class MutedMachineReplace(BaseModel):
    device_id: str
    machine_names: List[str]
```

## Client-Side Changes Required

Update your mobile app to use the new API endpoints:

### GET Request (Fetch muted machines)
```javascript
// OLD
const response = await fetch(
  `/devices/${encodeURIComponent(deviceId)}/muted-machines`
);

// NEW
const response = await fetch(
  `/api/v1/muted-machines?device_id=${encodeURIComponent(deviceId)}`
);
```

### POST Request (Add muted machine)
```javascript
// OLD
const response = await fetch(
  `/devices/${encodeURIComponent(deviceId)}/muted-machines`,
  {
    method: 'POST',
    body: JSON.stringify({ machine_name: machineName })
  }
);

// NEW
const response = await fetch(
  '/api/v1/muted-machines',
  {
    method: 'POST',
    body: JSON.stringify({ 
      device_id: deviceId,
      machine_name: machineName 
    })
  }
);
```

### DELETE Request (Remove muted machine)
```javascript
// OLD
const response = await fetch(
  `/devices/${encodeURIComponent(deviceId)}/muted-machines/${encodeURIComponent(machineName)}`,
  { method: 'DELETE' }
);

// NEW
const response = await fetch(
  `/api/v1/muted-machines?device_id=${encodeURIComponent(deviceId)}&machine_name=${encodeURIComponent(machineName)}`,
  { method: 'DELETE' }
);
```

### PUT Request (Replace all muted machines)
```javascript
// OLD
const response = await fetch(
  `/devices/${encodeURIComponent(deviceId)}/muted-machines`,
  {
    method: 'PUT',
    body: JSON.stringify({ machine_names: machineList })
  }
);

// NEW
const response = await fetch(
  '/api/v1/muted-machines',
  {
    method: 'PUT',
    body: JSON.stringify({ 
      device_id: deviceId,
      machine_names: machineList 
    })
  }
);
```

## Benefits

1. **No URL Encoding Issues**: Device IDs with special characters no longer cause routing problems
2. **Cleaner API**: More RESTful structure with consistent `/api/v1/` prefix
3. **Easier to Use**: No need for complex URL encoding schemes
4. **Future-Proof**: Can handle any device ID format without routing conflicts

## Testing

Run the updated test suite:
```bash
python test_mute_preferences.py
```

All tests have been updated to use the new API structure.
