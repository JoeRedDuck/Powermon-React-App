# 🔕 Device Mute Preferences - Quick Start

**Complete implementation of per-device machine notification muting**

## ⚡ Quick Setup (5 minutes)

```bash
# 1. Run the automated setup script
./setup_mute_preferences.sh

# That's it! The script will:
#   ✓ Check dependencies
#   ✓ Create database table
#   ✓ Run automated tests
#   ✓ Verify everything works
```

## 📋 What This Implements

✅ **Database Table** - Stores per-device mute preferences  
✅ **4 REST API Endpoints** - Full CRUD operations  
✅ **Smart Notification Filtering** - Per-device, per-machine  
✅ **Automated Tests** - Comprehensive test suite  
✅ **Complete Documentation** - Guides, examples, architecture  

## 🎯 Use Cases

### User Story 1: Mute Noisy Machine
*"I don't care about Machine_B (it's always having issues), but I want alerts for everything else"*

```javascript
// Mobile app: User toggles mute on Machine_B
POST /api/devices/johns_phone/muted-machines
Body: { "machine_name": "Machine_B" }

// Result: johns_phone gets no more Machine_B alerts
//         but still gets alerts for all other machines
```

### User Story 2: Multiple Devices, Different Preferences
*"The shop floor tablet should get all alerts, but personal phones can mute specific machines"*

```
Device_1 (johns_phone):  Muted=[Machine_A]
Device_2 (shop_tablet):  Muted=[]
Device_3 (marys_phone):  Muted=[Machine_B, Machine_C]

Alert: Machine_A offline
  → johns_phone:  ⊘ Silent (muted Machine_A)
  → shop_tablet:  ✓ Notification
  → marys_phone:  ✓ Notification (only muted B and C)
```

### User Story 3: Temporary Mute
*"I'm working on Machine_A right now, don't disturb me about it"*

```javascript
// Before maintenance
POST /api/devices/my_phone/muted-machines
Body: { "machine_name": "Machine_A" }

// ... work on Machine_A without interruptions ...

// After maintenance
DELETE /api/devices/my_phone/muted-machines/Machine_A
```

## 🚀 API Examples

### Check Current Muted Machines
```bash
curl http://localhost:8000/api/devices/my_phone/muted-machines
```

Response:
```json
{
  "device_id": "my_phone",
  "muted_machines": ["Machine_A", "Machine_B"]
}
```

### Mute a Machine
```bash
curl -X POST http://localhost:8000/api/devices/my_phone/muted-machines \
  -H "Content-Type: application/json" \
  -d '{"machine_name":"Machine_A"}'
```

Response:
```json
{
  "status": "added",
  "device_id": "my_phone",
  "machine_name": "Machine_A"
}
```

### Unmute a Machine
```bash
curl -X DELETE http://localhost:8000/api/devices/my_phone/muted-machines/Machine_A
```

Response:
```json
{
  "status": "removed",
  "device_id": "my_phone",
  "machine_name": "Machine_A"
}
```

### Bulk Sync (Replace All)
```bash
curl -X PUT http://localhost:8000/api/devices/my_phone/muted-machines \
  -H "Content-Type: application/json" \
  -d '{"machine_names":["Machine_A","Machine_C"]}'
```

Response:
```json
{
  "status": "replaced",
  "device_id": "my_phone",
  "muted_machines": ["Machine_A", "Machine_C"]
}
```

## 📱 Mobile App Integration

### Step 1: Register Device with ID
```javascript
// When registering for push notifications
await fetch(`${API_URL}/api/v1/notifications/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    token: expoPushToken,
    device_name: "johns_phone"  // This becomes the device_id
  })
});
```

### Step 2: Add Mute Toggle to UI
```javascript
// In your machine list component
const [mutedMachines, setMutedMachines] = useState([]);

// Load muted machines on mount
useEffect(() => {
  async function loadMutedMachines() {
    const response = await fetch(
      `${API_URL}/api/devices/${deviceId}/muted-machines`
    );
    const data = await response.json();
    setMutedMachines(data.muted_machines);
  }
  loadMutedMachines();
}, []);

// Toggle function
async function toggleMute(machineId) {
  const isMuted = mutedMachines.includes(machineId);
  
  if (isMuted) {
    // Unmute
    await fetch(
      `${API_URL}/api/devices/${deviceId}/muted-machines/${machineId}`,
      { method: 'DELETE' }
    );
    setMutedMachines(prev => prev.filter(m => m !== machineId));
  } else {
    // Mute
    await fetch(
      `${API_URL}/api/devices/${deviceId}/muted-machines`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machine_name: machineId })
      }
    );
    setMutedMachines(prev => [...prev, machineId]);
  }
}

// In your JSX
<Switch
  value={mutedMachines.includes(machine.name)}
  onValueChange={() => toggleMute(machine.name)}
/>
```

## 🗂️ Files Created

### Core Implementation
- [models.py](models.py) - Added `DeviceMutePreference` model
- [db.py](db.py) - Added database functions
- [app.py](app.py) - Added API endpoints + notification filtering

### Database
- [migrations/add_device_mute_preferences.sql](migrations/add_device_mute_preferences.sql) - SQL migration script
- [create_mute_preferences_table.py](create_mute_preferences_table.py) - Python setup script

### Testing & Setup
- [test_mute_preferences.py](test_mute_preferences.py) - Comprehensive test suite
- [setup_mute_preferences.sh](setup_mute_preferences.sh) - One-click setup script

### Documentation
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Quick reference ⭐ Start here
- [MUTE_PREFERENCES_GUIDE.md](MUTE_PREFERENCES_GUIDE.md) - Complete implementation guide
- [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md) - System architecture and flow
- **README_MUTE_PREFERENCES.md** - This file (quick start)

## ✅ Testing Checklist

After running setup:

- [ ] Database table created successfully
- [ ] All automated tests pass
- [ ] Can get empty muted list for new device
- [ ] Can add machine to muted list
- [ ] Can remove machine from muted list
- [ ] Can replace entire muted list
- [ ] Notifications respect mute preferences
- [ ] Different devices have independent preferences

## 🔧 Manual Testing

### Test the API Manually

1. **Start your server:**
   ```bash
   uvicorn app:app --reload
   ```

2. **Open another terminal and test:**
   ```bash
   # Get current muted machines (should be empty)
   curl http://localhost:8000/api/devices/test_device/muted-machines
   
   # Add a machine (replace with actual machine name from your DB)
   curl -X POST http://localhost:8000/api/devices/test_device/muted-machines \
     -H "Content-Type: application/json" \
     -d '{"machine_name":"Machine_A"}'
   
   # Verify it was added
   curl http://localhost:8000/api/devices/test_device/muted-machines
   
   # Remove it
   curl -X DELETE http://localhost:8000/api/devices/test_device/muted-machines/Machine_A
   ```

### Test Notification Filtering

1. **Register a test device:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/notifications/register \
     -H "Content-Type: application/json" \
     -d '{"token":"test_token_123","device_name":"test_device"}'
   ```

2. **Mute a machine:**
   ```bash
   curl -X POST http://localhost:8000/api/devices/test_device/muted-machines \
     -H "Content-Type: application/json" \
     -d '{"machine_name":"Machine_A"}'
   ```

3. **Trigger an alert for that machine** (wait for next monitoring cycle)
   - Check server logs
   - Should see: "Skipping notification to device test_device (has muted machines)"

## 📊 Database Schema

```sql
CREATE TABLE device_mute_preferences (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR NOT NULL UNIQUE,
    muted_machines JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_mute_preferences_device_id 
  ON device_mute_preferences(device_id);
```

## 🎨 Suggested UI Elements

### Toggle in Machine Card
```
┌─────────────────────────────┐
│ Machine A      [Online]     │
│ Floor 1                     │
│ 🔔 Notifications   [●────]  │ ← Toggle switch
└─────────────────────────────┘
```

### Settings Page
```
Notification Settings
━━━━━━━━━━━━━━━━━━━━

Muted Machines (2)
  ✕ Machine A
  ✕ Machine B

[+ Add Machine]
```

### Inline Mute Action
```
┌─────────────────────────────┐
│ Machine A      [Offline]    │
│ Floor 1                     │
│ [View Details] [Mute] [Fix] │ ← Quick mute button
└─────────────────────────────┘
```

## 🚨 Common Issues

### Issue: "Machine not found" when adding to muted list

**Cause:** Machine name doesn't exist in database or name mismatch

**Solution:**
```bash
# List all machines
curl http://localhost:8000/api/v1/devices

# Use exact name from response
```

### Issue: Still receiving notifications after muting

**Checks:**
1. Verify device_id matches between registration and mute preference
2. Check server logs for "Skipping notification" messages
3. Ensure machine name is spelled exactly the same

**Debug:**
```bash
# Check notification tokens
curl http://localhost:8000/api/v1/notifications/tokens

# Check muted machines
curl http://localhost:8000/api/devices/YOUR_DEVICE_ID/muted-machines
```

### Issue: Setup script fails

**Common causes:**
- Database not running
- Missing Python packages
- Wrong database credentials in .env file

**Fix:**
```bash
# Check database connection
psql -U your_user -d your_database -c "SELECT 1;"

# Install missing packages
pip install sqlalchemy psycopg2-binary

# Verify .env file
cat .env | grep DB_
```

## 📈 Next Steps

1. **Deploy to Production**
   - Run `./setup_mute_preferences.sh` on production server
   - Restart application server
   - No mobile app changes required yet (backward compatible)

2. **Update Mobile App**
   - Add mute toggle UI
   - Implement API calls (see examples above)
   - Test thoroughly

3. **Monitor Usage**
   - Check which machines are most frequently muted
   - May indicate machines need attention or better calibration

4. **Future Enhancements**
   - Time-based muting (e.g., "Mute for 2 hours")
   - Mute by notification type (e.g., only offline alerts)
   - Group muting (e.g., "Mute all freezers")

## 📞 Quick Command Reference

```bash
# Setup
./setup_mute_preferences.sh

# Manual setup
python3 create_mute_preferences_table.py

# Run tests
python3 test_mute_preferences.py

# Start server
uvicorn app:app --reload

# Check logs
tail -f server.log | grep -i mute

# Database query
psql your_db -c "SELECT * FROM device_mute_preferences;"
```

## 💡 Tips

1. **Device ID Strategy:** Use consistent, user-friendly device IDs like "johns_iphone" instead of random tokens
2. **Bulk Sync:** Use PUT endpoint when app launches to sync local preferences with server
3. **Offline Support:** Cache muted list locally, sync when online
4. **User Feedback:** Show toast/snackbar when muting: "Muted Machine_A"
5. **Visual Indicators:** Use 🔕 icon for muted machines in list view

## 🎓 Learn More

- **Implementation Details:** [MUTE_PREFERENCES_GUIDE.md](MUTE_PREFERENCES_GUIDE.md)
- **System Architecture:** [ARCHITECTURE_DIAGRAM.md](ARCHITECTURE_DIAGRAM.md)
- **API Reference:** [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

## ✨ Features Summary

| Feature | Status | Description |
|---------|--------|-------------|
| Database Schema | ✅ | `device_mute_preferences` table with indexes |
| GET Endpoint | ✅ | Retrieve muted machines for device |
| POST Endpoint | ✅ | Add machine to muted list |
| DELETE Endpoint | ✅ | Remove machine from muted list |
| PUT Endpoint | ✅ | Bulk replace muted list |
| Notification Filter | ✅ | Skip notifications for muted machines |
| Machine Validation | ✅ | Verify machines exist before muting |
| Per-Device Prefs | ✅ | Each device has independent settings |
| Automated Tests | ✅ | Comprehensive test coverage |
| Documentation | ✅ | Complete guides and examples |

---

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** February 2026  

**Questions?** Check [MUTE_PREFERENCES_GUIDE.md](MUTE_PREFERENCES_GUIDE.md) for detailed documentation.
# Device Mute Preferences - Implementation Guide

## Overview

This document describes the complete implementation of device-specific mute preferences for machine notifications. The system allows individual devices (mobile apps) to mute notifications from specific machines while still receiving alerts from other machines.

## Architecture

### Database Schema

**Table: `device_mute_preferences`**
```sql
CREATE TABLE device_mute_preferences (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR NOT NULL UNIQUE,  -- Device identifier (typically device_name from notification_token)
    muted_machines JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of machine names
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_mute_preferences_device_id ON device_mute_preferences(device_id);
```

**Key Features:**
- `device_id`: Unique identifier per device (typically the device name registered with push token)
- `muted_machines`: JSON array storing list of machine names this device has muted
- Auto-updating `updated_at` timestamp via database trigger

### Code Structure

#### 1. Database Model (`models.py`)
```python
class DeviceMutePreference(Base):
    __tablename__ = "device_mute_preferences"
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, unique=True, nullable=False, index=True)
    muted_machines = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

#### 2. Database Operations (`db.py`)

**Core Functions:**
- `get_muted_machines(db, device_id)` - Get list of muted machines for a device
- `add_muted_machine(db, device_id, machine_name)` - Add a machine to muted list
- `remove_muted_machine(db, device_id, machine_name)` - Remove a machine from muted list
- `replace_muted_machines(db, device_id, machine_names)` - Replace entire muted list (bulk operation)
- `get_all_mute_preferences(db)` - Get all preferences as dict for efficient notification filtering
- `get_notification_tokens_with_devices(db)` - Get tokens with their device IDs

#### 3. API Endpoints (`app.py`)

All endpoints follow REST conventions:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/devices/{device_id}/muted-machines` | Get list of muted machines for device |
| POST | `/api/devices/{device_id}/muted-machines` | Add a machine to muted list |
| DELETE | `/api/devices/{device_id}/muted-machines/{machine_name}` | Remove a machine from muted list |
| PUT | `/api/devices/{device_id}/muted-machines` | Replace entire muted list (bulk sync) |

## API Documentation

### 1. Get Muted Machines

**Endpoint:** `GET /api/devices/{device_id}/muted-machines`

**Description:** Retrieves the list of machines that are muted for a specific device.

**Response:**
```json
{
  "device_id": "my_phone",
  "muted_machines": ["Machine_A", "Machine_B"]
}
```

**Status Codes:**
- `200 OK` - Success (returns empty array if no preferences exist)

---

### 2. Add Muted Machine

**Endpoint:** `POST /api/devices/{device_id}/muted-machines`

**Description:** Adds a machine to the device's muted list.

**Request Body:**
```json
{
  "machine_name": "Machine_A"
}
```

**Response (Success):**
```json
{
  "status": "added",
  "device_id": "my_phone",
  "machine_name": "Machine_A"
}
```

**Response (Already Muted):**
```json
{
  "status": "already_muted",
  "device_id": "my_phone",
  "machine_name": "Machine_A"
}
```

**Status Codes:**
- `200 OK` - Success or already muted
- `404 Not Found` - Machine doesn't exist in database

---

### 3. Remove Muted Machine

**Endpoint:** `DELETE /api/devices/{device_id}/muted-machines/{machine_name}`

**Description:** Removes a machine from the device's muted list.

**Response:**
```json
{
  "status": "removed",
  "device_id": "my_phone",
  "machine_name": "Machine_A"
}
```

**Status Codes:**
- `200 OK` - Successfully removed
- `404 Not Found` - Machine was not in the muted list

---

### 4. Replace Muted Machines (Bulk Sync)

**Endpoint:** `PUT /api/devices/{device_id}/muted-machines`

**Description:** Replaces the entire muted machines list. Useful for syncing device preferences.

**Request Body:**
```json
{
  "machine_names": ["Machine_A", "Machine_B", "Machine_C"]
}
```

**Response:**
```json
{
  "status": "replaced",
  "device_id": "my_phone",
  "muted_machines": ["Machine_A", "Machine_B", "Machine_C"]
}
```

**Status Codes:**
- `200 OK` - Successfully replaced
- `404 Not Found` - One or more machines don't exist in database

**Note:** Pass an empty array `[]` to clear all muted machines.

---

## Notification Logic

### How Mute Preferences Work

The notification system has been enhanced to respect per-device mute preferences:

1. **Notification Generation:**
   - When a machine alert is triggered, the system identifies all affected machines
   - Machine names are passed to `send_expo_notification()`

2. **Mute Checking:**
   - For each registered device, the system queries its mute preferences
   - If ANY machine in the notification is muted by that device, the notification is skipped
   - Other devices continue to receive the notification normally

3. **Implementation:**
```python
def send_expo_notification(title, body, priority="default", machine_names=None):
    # Get all device tokens with their IDs
    token_data = db.get_notification_tokens_with_devices(session)
    
    # Get mute preferences for all devices
    mute_prefs = db.get_all_mute_preferences(session)
    
    for token_info in token_data:
        device_id = token_info["device_name"]
        
        # Check if device has muted any machines in this alert
        if machine_names and device_id:
            muted_machines = mute_prefs.get(device_id, [])
            if any(machine in muted_machines for machine in machine_names):
                # Skip this device
                continue
        
        # Send notification to this device
        ...
```

### Alert Monitor Integration

The `alert_monitor()` function has been updated to track affected machines:

```python
# Collect all affected machine names
affected_machines = []
affected_machines.extend([d["name"] for d in new_none])  # Power loss
affected_machines.extend([d["name"] for d in new_low])   # Low power
affected_machines.extend([d["name"] for d in new_off])   # Offline

# Send notification with machine context
send_expo_notification(title, body, priority="high", machine_names=affected_machines)
```

## Installation & Setup

### 1. Create Database Table

**Option A: Using SQLAlchemy (Recommended)**
```bash
python create_mute_preferences_table.py
```

**Option B: Using SQL Migration**
```bash
psql -U your_user -d your_database -f migrations/add_device_mute_preferences.sql
```

### 2. Verify Installation

Check that the table was created:
```sql
SELECT * FROM device_mute_preferences;
```

### 3. Run Tests

```bash
# Make sure your server is running
python test_mute_preferences.py
```

## Mobile App Integration

### Registration Flow

1. **Register Push Token with Device ID:**
```javascript
// When registering for push notifications
POST /api/v1/notifications/register
{
  "token": "ExponentPushToken[...]",
  "device_name": "johns_iphone"  // Use this as device_id
}
```

2. **Use Same Device ID for Mute Preferences:**
```javascript
// The device_name becomes the device_id for mute preferences
const deviceId = "johns_iphone";
```

### Typical Usage Scenarios

#### Scenario 1: User Mutes a Machine

```javascript
async function muteMachine(machineId) {
  const response = await fetch(
    `${API_URL}/api/devices/${deviceId}/muted-machines`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_name: machineId })
    }
  );
  return response.json();
}
```

#### Scenario 2: User Unmutes a Machine

```javascript
async function unmuteOn(machineId) {
  const response = await fetch(
    `${API_URL}/api/devices/${deviceId}/muted-machines/${machineId}`,
    { method: 'DELETE' }
  );
  return response.json();
}
```

#### Scenario 3: Get Current Muted List

```javascript
async function getMutedMachines() {
  const response = await fetch(
    `${API_URL}/api/devices/${deviceId}/muted-machines`
  );
  const data = await response.json();
  return data.muted_machines;
}
```

#### Scenario 4: Bulk Sync (e.g., after reinstall)

```javascript
async function syncMutedMachines(mutedList) {
  const response = await fetch(
    `${API_URL}/api/devices/${deviceId}/muted-machines`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ machine_names: mutedList })
    }
  );
  return response.json();
}
```

## UI/UX Recommendations

### Machine List View

For each machine, add a mute toggle:

```
┌─────────────────────────────────┐
│  Machine A        [Online]      │
│  Location: Floor 1              │
│  🔔 Notifications  [Toggle]     │  <-- Mute/Unmute control
└─────────────────────────────────┘
```

### Settings Screen

Provide a dedicated section for notification preferences:

```
Settings
├── Notifications
│   ├── Enable All Notifications [Toggle]
│   ├── Muted Machines (3)
│   │   ├── Machine A      [Remove]
│   │   ├── Machine B      [Remove]
│   │   └── Machine C      [Remove]
│   └── Alert Sounds       [Toggle]
```

## Testing

### Manual Testing Checklist

- [ ] Register a device with a notification token
- [ ] Mute a machine for that device
- [ ] Verify the device does NOT receive notifications for that machine
- [ ] Verify OTHER devices still receive the notification
- [ ] Unmute the machine
- [ ] Verify notifications resume for that device
- [ ] Test with multiple machines muted
- [ ] Test bulk replace functionality
- [ ] Test with non-existent machine names
- [ ] Test with multiple devices

### Automated Testing

Run the provided test script:
```bash
python test_mute_preferences.py
```

Expected output:
```
=== Testing Device Mute Preferences API ===

1. Getting initial muted machines list...
   ✓ Initial list is empty

2. Adding a machine to muted list...
   ✓ Machine added successfully

...

✓ All tests passed!
```

## Performance Considerations

1. **Database Indexing:**
   - `device_id` is indexed for fast lookups
   - JSONB type allows efficient array operations

2. **Notification Filtering:**
   - All mute preferences loaded once per notification batch
   - Dictionary lookup: O(1) per device
   - Array intersection check: O(n×m) where n=muted machines, m=affected machines

3. **Scalability:**
   - Suitable for hundreds of devices
   - For thousands of devices, consider caching mute preferences in Redis

## Troubleshooting

### Issue: Notifications still sent to muted devices

**Check:**
1. Verify device_id matches between notification token and mute preference:
   ```sql
   SELECT * FROM notification_token WHERE device_name = 'your_device_id';
   SELECT * FROM device_mute_preferences WHERE device_id = 'your_device_id';
   ```

2. Verify machine names match exactly (case-sensitive):
   ```sql
   SELECT name FROM machine;
   SELECT muted_machines FROM device_mute_preferences;
   ```

### Issue: 404 when adding machine to muted list

**Reason:** The machine doesn't exist in the database.

**Solution:** Only allow users to mute machines that exist. Fetch machine list first:
```javascript
GET /api/v1/devices
```

### Issue: Mute preferences not persisting

**Check:**
1. Database table exists:
   ```sql
   \dt device_mute_preferences
   ```

2. Check for errors in server logs when making API calls

## Security Considerations

1. **Device ID Validation:**
   - Currently no authentication required
   - Consider adding device authentication if needed

2. **Input Validation:**
   - Machine names validated against existing machines
   - Prevents injection via machine_name parameter

3. **Rate Limiting:**
   - Consider adding rate limits to mute endpoints
   - Prevents abuse of bulk operations

## Future Enhancements

### Possible Improvements:

1. **Time-Based Muting:**
   - Mute for specific hours (e.g., "Don't disturb after 10 PM")
   - Temporary mutes (e.g., "Mute for 2 hours")

2. **Notification Types:**
   - Mute only specific alert types (offline, low power, etc.)
   - Severity-based filtering

3. **Machine Groups:**
   - Mute entire locations or machine types
   - "Mute all freezers" functionality

4. **Sync Across Devices:**
   - Link multiple devices to same user account
   - Sync preferences across user's devices

5. **Analytics:**
   - Track which machines are most frequently muted
   - Identify noise vs. actionable alerts

## Migration Guide

If you have an existing deployment:

1. **Backup Database:**
   ```bash
   pg_dump your_database > backup.sql
   ```

2. **Apply Migration:**
   ```bash
   python create_mute_preferences_table.py
   ```

3. **No Data Migration Needed:**
   - New table starts empty
   - Users configure mute preferences as needed

4. **Deploy New Code:**
   - Update Python files (models.py, db.py, app.py)
   - Restart server

5. **Update Mobile Apps:**
   - Deploy new version with mute UI
   - Old versions will continue to work (they'll just receive all notifications)

## Support

For issues or questions, check:
1. Server logs for error messages
2. Database query logs
3. Test script output for debugging

---

**Implementation Date:** February 2026  
**Version:** 1.0  
**Compatibility:** PostgreSQL 12+, Python 3.8+, SQLAlchemy 1.4+
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
