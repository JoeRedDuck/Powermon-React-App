# Frontend Quick Start Guide
**Power Monitoring API - Essential Endpoints**

🎯 **Give this file to your frontend developer**

---

## Server Info

**Base URL:** `http://your-server-ip:8000`  
**CORS:** Enabled for all origins  
**Format:** JSON

---

## 🚀 Most Important Endpoints

### 1. Get All Devices (Poll this regularly)
```javascript
GET /api/v1/devices

// Response
[
  {
    "name": "Pump 1",
    "mac": "AA:BB:CC:DD:EE:FF",  // null if no monitor
    "id": 123,                    // null if no monitor
    "machine_type": "Pump",
    "location": "Building 1",
    "last_seen": "2026-02-06T10:30:00Z",  // null if no data yet
    "last_power": 500              // watts, null if no data yet
  }
]
```

### 2. Get Device Status (with status field)
```javascript
GET /api/v1/devices/{mac}

// Response includes "status" field:
{
  "status": "online"  // "online", "offline", "no power", "low power"
  // ... rest of device data
}
```

### 3. Create Device
```javascript
POST /api/v1/devices
{
  "name": "Pump 1",
  "mac": "AA:BB:CC:DD:EE:FF",  // optional, use "" for none
  "id": 123,                    // optional, use 0 for none
  "machine_type": "Pump",
  "location": "Building 1"
}

// You can safely send id: 0 and mac: "" - they become null automatically
```

### 4. Delete Device
```javascript
// IMPORTANT: Check if device has MAC first!

if (device.mac === null) {
  // Delete machine without monitor
  DELETE /api/v1/machines/Pump%201
} else {
  // Delete device with monitor
  DELETE /api/v1/devices/AA:BB:CC:DD:EE:FF
}
```

### 5. Get Statistics
```javascript
GET /api/v1/device_stats

// Response
{
  "online": 10,
  "offline": 2,
  "no power": 1,
  "low power": 3
}
```

### 6. Get Power History
```javascript
GET /api/v1/power?mac=AA:BB:CC:DD:EE:FF&time_range=1h&bucket=1m

// Response
{
  "points": [
    {"date": "2026-02-06T09:30:00Z", "value": 450},
    {"date": "2026-02-06T09:31:00Z", "value": 520}
  ],
  "min": 450,
  "max": 520,
  "average": 485
}

// time_range: 5m, 10m, 30m, 1h, 3h, 6h, 12h, 24h
// bucket: 10s, 20s, 30s, 1m, 2m, 5m, 10m
```

---

## 🔔 Push Notifications

### 7. Register Device for Notifications
```javascript
POST /api/v1/notifications/register
{
  "token": "ExponentPushToken[xxxxxx]",
  "device_name": "johns_phone"  // SAVE THIS - needed for muting!
}
```

### 8. Mute a Machine
```javascript
POST /api/v1/muted-machines
{
  "device_id": "johns_phone",  // same as device_name from registration
  "machine_name": "Pump 1"
}
```

### 9. Get Muted Machines
```javascript
GET /api/v1/muted-machines?device_id=johns_phone

// Response
{
  "device_id": "johns_phone",
  "muted_machines": ["Pump 1", "Pump 3"]
}
```

### 10. Unmute a Machine
```javascript
DELETE /api/v1/muted-machines?device_id=johns_phone&machine_name=Pump%201
```

---

## 📱 React Native Example Code

### Fetch All Devices
```javascript
const API_BASE = 'http://192.168.1.100:8000';

async function fetchDevices() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/devices`);
    const devices = await response.json();
    return devices;
  } catch (error) {
    console.error('Error fetching devices:', error);
    return [];
  }
}
```

### Create Device
```javascript
async function createDevice(name, mac, id, machineType, location) {
  const response = await fetch(`${API_BASE}/api/v1/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: name,
      mac: mac || "",        // Empty string if no MAC
      id: id || 0,           // 0 if no monitor ID
      machine_type: machineType,
      location: location
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail.reason);
  }
  
  return await response.json();
}
```

### Delete Device (Smart Version)
```javascript
async function deleteDevice(device) {
  let url;
  if (device.mac === null) {
    // Machine without monitor
    url = `${API_BASE}/api/v1/machines/${encodeURIComponent(device.name)}`;
  } else {
    // Device with monitor
    url = `${API_BASE}/api/v1/devices/${encodeURIComponent(device.mac)}`;
  }
  
  const response = await fetch(url, { method: 'DELETE' });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail.reason);
  }
  
  return await response.json();
}
```

### Register for Notifications
```javascript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function registerForNotifications() {
  // Get Expo push token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  
  // Generate or retrieve device ID
  let deviceId = await AsyncStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = `device_${Date.now()}`;
    await AsyncStorage.setItem('device_id', deviceId);
  }
  
  // Register with server
  const response = await fetch(`${API_BASE}/api/v1/notifications/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: token,
      device_name: deviceId
    })
  });
  
  return deviceId;  // Save this for mute preferences!
}
```

### Toggle Mute for Machine
```javascript
async function toggleMute(deviceId, machineName, isMuted) {
  if (isMuted) {
    // Unmute
    await fetch(
      `${API_BASE}/api/v1/muted-machines?device_id=${deviceId}&machine_name=${encodeURIComponent(machineName)}`,
      { method: 'DELETE' }
    );
  } else {
    // Mute
    await fetch(`${API_BASE}/api/v1/muted-machines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        machine_name: machineName
      })
    });
  }
}
```

### Load Muted Machines on App Start
```javascript
async function loadMutedMachines(deviceId) {
  const response = await fetch(
    `${API_BASE}/api/v1/muted-machines?device_id=${deviceId}`
  );
  const data = await response.json();
  return data.muted_machines;  // Array of machine names
}
```

### Poll for Updates
```javascript
import { useEffect, useState } from 'react';

function useDevices() {
  const [devices, setDevices] = useState([]);
  
  useEffect(() => {
    // Fetch immediately
    fetchDevices().then(setDevices);
    
    // Poll every 2 seconds
    const interval = setInterval(() => {
      fetchDevices().then(setDevices);
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  return devices;
}
```

---

## 🎨 UI Component Ideas

### Device Card
```javascript
function DeviceCard({ device, onDelete, onMute, isMuted }) {
  const getStatusColor = (status) => {
    switch(status) {
      case 'online': return '#4CAF50';
      case 'offline': return '#757575';
      case 'no power': return '#F44336';
      case 'low power': return '#FF9800';
      default: return '#757575';
    }
  };
  
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{device.name}</Text>
      <Text>Type: {device.machine_type}</Text>
      <Text>Location: {device.location}</Text>
      
      {device.last_power !== null && (
        <Text style={{ color: getStatusColor(device.status) }}>
          Power: {device.last_power}W
        </Text>
      )}
      
      <View style={styles.actions}>
        <Button 
          title={isMuted ? "🔕 Muted" : "🔔 Active"} 
          onPress={onMute}
        />
        <Button 
          title="Delete" 
          color="#F44336"
          onPress={onDelete}
        />
      </View>
    </View>
  );
}
```

### Statistics Dashboard
```javascript
function StatsDashboard() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/device_stats`)
      .then(r => r.json())
      .then(setStats);
  }, []);
  
  if (!stats) return <Text>Loading...</Text>;
  
  return (
    <View style={styles.dashboard}>
      <StatCard label="Online" value={stats.online} color="#4CAF50" />
      <StatCard label="Offline" value={stats.offline} color="#757575" />
      <StatCard label="No Power" value={stats['no power']} color="#F44336" />
      <StatCard label="Low Power" value={stats['low power']} color="#FF9800" />
    </View>
  );
}
```

---

## ⚠️ Important Notes

### Device Deletion
- Devices **WITH** monitors: Use `/api/v1/devices/{mac}`
- Devices **WITHOUT** monitors: Use `/api/v1/machines/{name}`
- Always check if `device.mac === null` before deleting!

### Creating Devices
- You can send `id: 0` and `mac: ""` safely
- Server converts them to `null` automatically
- No validation errors for these values

### Mute Preferences
- Use the same `device_name` you registered with notifications
- Store it locally with AsyncStorage
- Each device has independent mute preferences
- Muting is per-machine, not all-or-nothing

### URL Encoding
- Always `encodeURIComponent()` for:
  - Machine names with spaces
  - Any special characters in URLs

### Polling
- Poll `/api/v1/devices` every 2-5 seconds for live updates
- Consider using a faster interval (1s) if you need real-time data
- Use slower intervals (10s+) to save battery on mobile

---

## 🐛 Common Issues & Solutions

### Issue: Getting 400 error when creating device
**Solution:** Make sure all required fields are provided:
- `name` (required, not empty)
- `machine_type` (required, not empty)
- `location` (required, not empty)

### Issue: Can't delete device, getting 404
**Solution:** Check if device has a MAC:
```javascript
if (device.mac === null) {
  // Use machines endpoint
  DELETE /api/v1/machines/{name}
}
```

### Issue: Notifications not working
**Solution:** 
1. Register device first: `POST /api/v1/notifications/register`
2. Save the `device_name` locally
3. Use same `device_name` for mute preferences

### Issue: Getting CORS errors
**Solution:** CORS is enabled on server. Check:
1. Correct server IP and port
2. Server is actually running
3. No firewall blocking the port

---

## 📞 Need More Details?

- **Full API Reference:** See `API_REFERENCE.md`
- **System Architecture:** See `ARCHITECTURE_DIAGRAM.md`
- **Notification Details:** See `EXPO_NOTIFICATIONS_GUIDE.md`
- **Mute Preferences:** See `MUTE_PREFERENCES.md`

---

**Ready to start?** Just fetch `/api/v1/devices` and display them in a list. Everything else builds from there! 🚀
