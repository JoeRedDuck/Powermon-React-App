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
