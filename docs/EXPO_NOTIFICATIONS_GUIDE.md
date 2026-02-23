# Expo Push Notifications Setup Guide

## Overview
The system now uses Expo Push Notifications instead of Pushover. This allows your mobile app to receive real-time alerts about machine status and power events.

## Changes Made

### 1. Removed Pushover Dependencies
- Removed `PUSHOVER_TOKEN` and `PUSHOVER_USER` environment variables
- Removed `pushover()` function

### 2. Added Expo Push Notification Support
- New `send_expo_notification()` function
- Automatic notification to all registered devices
- Support for high-priority alerts

### 3. New API Endpoints

#### Register Notification Token
```http
POST /api/v1/notifications/register
Content-Type: application/json

{
  "token": "ExponentPushToken[YOUR_TOKEN_HERE]",
  "device_name": "John's iPhone"  // Optional
}

Response:
{
  "status": "registered",
  "token": "ExponentPushToken[YOUR_TOKEN_HERE]"
}
```

#### List All Tokens
```http
GET /api/v1/notifications/tokens

Response:
{
  "tokens": [
    "ExponentPushToken[token1]",
    "ExponentPushToken[token2]"
  ],
  "count": 2
}
```

#### Delete Token
```http
DELETE /api/v1/notifications/tokens/ExponentPushToken[YOUR_TOKEN_HERE]

Response:
{
  "status": "deleted"
}
```

## Mobile App Integration

### 1. Get Expo Push Token
In your React Native app:

```javascript
import * as Notifications from 'expo-notifications';

async function registerForPushNotifications() {
  // Request permissions
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    alert('Permission denied for notifications');
    return;
  }

  // Get token
  const token = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('Expo Push Token:', token);
  
  return token;
}
```

### 2. Register Token with Backend
```javascript
async function registerTokenWithBackend(token, deviceName) {
  try {
    const response = await fetch('http://192.168.11.175:8000/api/v1/notifications/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: token,
        device_name: deviceName
      })
    });
    
    const data = await response.json();
    console.log('Token registered:', data);
  } catch (error) {
    console.error('Failed to register token:', error);
  }
}
```

### 3. Handle Incoming Notifications
```javascript
import { useEffect } from 'react';

useEffect(() => {
  // Handle notification when app is in foreground
  const subscription = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification);
  });

  // Handle notification tap
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response);
  });

  return () => {
    subscription.remove();
    responseSubscription.remove();
  };
}, []);
```

### 4. Complete App Setup Example
```javascript
import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Configure how notifications should appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function App() {
  const [expoPushToken, setExpoPushToken] = useState('');

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
      // Register with your backend
      registerTokenWithBackend(token, Device.deviceName);
    });
  }, []);

  return (
    // Your app components
  );
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}
```

## Notification Triggers

### 1. Machine Status Alerts
The system monitors all machines and sends notifications when:
- **Power loss**: Machine reports 0 watts
- **Low power**: Machine reports < 50 watts
- **Offline**: Machine hasn't reported in > 1 minute

Example notification:
```
Title: "Machine Alert"
Body: "Power loss alert: CNC Machine 1"
Priority: high
```

### 2. UPS Power Alerts
The system monitors UPS status and sends notifications when:
- **UPS on battery**: Mains power lost
- **UPS restored**: Mains power back

Example notification:
```
Title: "Critical Power Alert"
Body: "UPS is on battery - mains power to factory is down"
Priority: high
```

## Testing

### Test with curl
```bash
# Register a token
curl -X POST http://192.168.11.175:8000/api/v1/notifications/register \
  -H "Content-Type: application/json" \
  -d '{"token": "ExponentPushToken[YOUR_TOKEN]", "device_name": "Test Device"}'

# List tokens
curl http://192.168.11.175:8000/api/v1/notifications/tokens

# Delete a token
curl -X DELETE http://192.168.11.175:8000/api/v1/notifications/tokens/ExponentPushToken[YOUR_TOKEN]
```

### Test notification delivery
Use the test script:
```bash
python3 test_expo_notifications.py
```

Or test directly using Expo's push notification tool:
https://expo.dev/notifications

## Database Schema

The `notification_token` table stores registered tokens:
```sql
CREATE TABLE notification_token (
  id SERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Troubleshooting

### Token not receiving notifications
1. Verify token is registered:
   ```bash
   curl http://192.168.11.175:8000/api/v1/notifications/tokens
   ```
2. Check if token format is correct (should start with `ExponentPushToken[`)
3. Verify app has notification permissions
4. Check server logs for send errors:
   ```bash
   sudo journalctl -u powermon-api -f
   ```

### Notifications not appearing
1. Check if app is in foreground (configure `setNotificationHandler`)
2. Verify notification permissions in device settings
3. For Android, ensure notification channel is set up
4. Test token directly at https://expo.dev/notifications

### Multiple devices receiving notifications
This is expected behavior - all registered tokens receive alerts. To stop:
```bash
# Delete specific token
curl -X DELETE http://192.168.11.175:8000/api/v1/notifications/tokens/YOUR_TOKEN
```

## Migration from Pushover

### What Changed
- ✅ Removed Pushover API calls
- ✅ Added Expo push notification support
- ✅ Added token registration endpoints
- ✅ Notifications sent to all registered devices
- ✅ Support for priority levels

### What Stayed the Same
- ✅ Alert logic (machine status, UPS monitoring)
- ✅ Cooldown periods
- ✅ Deduplication
- ✅ Alert messages

### Environment Variables
You can now remove from `.env`:
```
# No longer needed
PUSHOVER_TOKEN=...
PUSHOVER_USER=...
```

## Production Checklist

- [ ] Update mobile app to register push tokens on startup
- [ ] Test notification delivery to all devices
- [ ] Verify high-priority alerts work correctly
- [ ] Set up token cleanup for uninstalled apps (optional)
- [ ] Monitor notification delivery in logs
- [ ] Remove Pushover credentials from `.env`
