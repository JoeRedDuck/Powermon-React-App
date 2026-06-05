# Power Monitoring API Reference
**For Frontend Developers**

Base URL: `http://tapomon:8000`

---

## 📱 Devices & Machines

### List All Devices
```
GET /api/v1/devices
```

**Response:**
```json
[
  {
    "mac": "AA:BB:CC:DD:EE:FF",
    "id": 123,
    "name": "Pump 1",
    "type": "IPM",
    "machine_type": "Pump",
    "location": "Building 1",
    "last_seen": "2026-02-06T10:30:00Z",
    "last_power": 500
  },
  {
    "mac": null,
    "id": null,
    "name": "Pump 2",
    "type": null,
    "machine_type": "Pump",
    "location": "Building 2",
    "last_seen": null,
    "last_power": null
  }
]
```

**Notes:**
- Devices without monitors will have `mac: null` and `id: null`
- `last_seen` and `last_power` will be `null` if no data received yet
- `low_power_threshold` (integer or `null`) is the per-machine override for the "low power" alert bar in watts. `null` means use the global default (50 W). Settable via `POST/PUT /api/v1/devices`.

---

### Get Single Device by MAC
```
GET /api/v1/devices/{mac}
```

**Example:**
```
GET /api/v1/devices/AA:BB:CC:DD:EE:FF
```

**Response:**
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "id": 123,
  "name": "Pump 1",
  "type": "IPM",
  "machine_type": "Pump",
  "location": "Building 1",
  "last_seen": "2026-02-06T10:30:00Z",
  "last_power": 500,
  "status": "online"
}
```

**Status Values:**
- `"online"` - Device is functioning normally
- `"offline"` - No data received recently
- `"no power"` - Device reporting 0 power
- `"low power"` - Device reporting < 50W (configurable)

---

### Get Device by Machine Name
```
GET /api/v1/machines/{machine_name}
```

**Example:**
```
GET /api/v1/machines/Pump%201
```

**Response:** Same as Get Single Device by MAC

**Note:** URL encode spaces and special characters in machine names

---

### Create Device/Machine

```
POST /api/v1/devices
Content-Type: application/json
```

**Three Scenarios:**

#### 1. Create Device with New Monitor
```json
{
  "name": "Pump 1",
  "mac": "AA:BB:CC:DD:EE:FF",
  "id": 123,
  "machine_type": "Pump",
  "location": "Building 1"
}
```

#### 2. Attach Existing Monitor to Machine
```json
{
  "name": "Pump 2",
  "id": 123,
  "machine_type": "Pump",
  "location": "Building 1"
}
```

#### 3. Create Machine Without Monitor
```json
{
  "name": "Pump 3",
  "machine_type": "Pump",
  "location": "Building 1"
}
```

**Success Response (200):**
```json
{
  "status": "created",
  "device": {
    "name": "Pump 1",
    "id": 123,
    "mac": "AA:BB:CC:DD:EE:FF",
    "machine_type": "Pump",
    "location": "Building 1"
  }
}
```

**⚠️ Important:**
- You can send `id: 0` or `mac: ""` - they will be treated as "not provided"
- Machine names must be unique when creating without a monitor
- MAC addresses must be unique
- Monitor IDs must exist when attaching existing monitors

---

### Update Device
```
PUT /api/v1/devices/{mac}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Pump 1 Updated",
  "location": "Building 2",
  "machine_type": "High Power Pump"
}
```

**Response:**
```json
{
  "status": "updated"
}
```

---

### Delete Device (with Monitor)
```
DELETE /api/v1/devices/{mac}
```

**Success Response (200):**
```json
{
  "status": "deleted"
}
```

**Behaviour (May 2026):** Deletes the machine row and the machine's poll history. **The attached monitor is preserved** — its `id` and MAC are unchanged, but its `machine_name` is set to NULL so it can be re-assigned to a new machine without re-adding the monitor.

**⚠️ Important:** Only use this for devices that have an attached monitor (MAC available). For machines with no monitor, use the endpoint below.

---

### Delete Machine (without Monitor)
```
DELETE /api/v1/machines/{machine_name}
```

**Example:**
```
DELETE /api/v1/machines/Pump%203
```

**Response:**
```json
{
  "status": "deleted"
}
```

**Behaviour (May 2026):** Deletes the machine row and the machine's poll history. Any monitors that were attached are orphaned (`machine_name → NULL`), not deleted.

**💡 Mobile App Code:**
```javascript
// Smart delete function
async function deleteDevice(device) {
  if (device.mac === null) {
    // Machine without monitor
    return await DELETE(`/api/v1/machines/${encodeURIComponent(device.name)}`);
  } else {
    // Device with monitor
    return await DELETE(`/api/v1/devices/${encodeURIComponent(device.mac)}`);
  }
}
```

---

## 📊 Device Statistics

### Get Device Stats
```
GET /api/v1/device_stats
```

**Response:**
```json
{
  "offline": 2,
  "online": 8,
  "no power": 1,
  "low power": 3
}
```

---

### Get Status with Filters
```
GET /api/v1/status
GET /api/v1/status?location=Building%201
GET /api/v1/status?machine_type=Pump
GET /api/v1/status?status=offline
```

**Response:** Array of devices (same format as List All Devices)

---

## 📈 Power Data

### Get Power History
```
GET /api/v1/power?mac={mac}&time_range={range}&bucket={bucket}
```

**Parameters:**
- `mac` - Monitor MAC address (required)
- `time_range` - One of: `5m`, `10m`, `30m`, `1h`, `3h`, `6h`, `12h`, `24h`
- `bucket` - Aggregation interval: `10s`, `20s`, `30s`, `1m`, `2m`, `5m`, `10m`

**Example:**
```
GET /api/v1/power?mac=AA:BB:CC:DD:EE:FF&time_range=1h&bucket=1m
```

**Response:**
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "time_range": "1h",
  "bucket": "1m",
  "points": [
    {"date": "2026-02-06T09:30:00Z", "value": 450},
    {"date": "2026-02-06T09:31:00Z", "value": 520},
    {"date": "2026-02-06T09:32:00Z", "value": 480}
  ],
  "min": 450,
  "max": 520,
  "average": 483
}
```

`points` are bucket averages (smoothed for graphing). `min`, `max`, and `average` are computed from the **raw polls** within `time_range` (excluding offline/NULL readings), so they are independent of the chosen `bucket` size and consistent across overlapping ranges.

---

### Check Poll Count
```
POST /api/v1/checkPoll/{mac}
```

**Returns the number of poll records for a given device (by MAC address).**

**Example:**
```
POST /api/v1/checkPoll/AA:BB:CC:DD:EE:FF
```

**Response:**
```json
{
  "count": 1523
}
```

**Use Case:** Check if a device has historical data before displaying charts or deleting

---

### Insert Poll Data
```
POST /api/v1/polls
Content-Type: application/json
```

**Insert a new poll record from external data sources. Automatically resolves machine_name from monitor_mac.**

**Request:**
```json
{
  "monitor_mac": "AA:BB:CC:DD:EE:FF",
  "power_usage": 1500,
  "poll_time": "2026-02-10T10:30:00Z"  // Optional, defaults to current time
}
```

**Success Response (200):**
```json
{
  "status": "created",
  "poll": {
    "monitor_mac": "AA:BB:CC:DD:EE:FF",
    "power_usage": 1500,
    "poll_time": "2026-02-10T10:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "detail": {
    "status": "monitor_not_found",
    "reason": "Monitor AA:BB:CC:DD:EE:FF not found. Register the device first."
  }
}
```

**⚠️ Important:**
- Monitor must exist in database before inserting polls
- Monitor must be assigned to a machine
- If `poll_time` is omitted, uses current UTC time
- Used by external monitoring scripts/services

---

## 🔔 Push Notifications

### Register Notification Token
```
POST /api/v1/notifications/register
Content-Type: application/json
```

**Request:**
```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxx]",
  "device_name": "johns_phone"
}
```

**Response:**
```json
{
  "status": "registered",
  "token": "ExponentPushToken[xxxxxxxxxxxxx]"
}
```

**Note:** Save `device_name` locally - it's used for mute preferences

---

### List All Tokens
```
GET /api/v1/notifications/tokens
```

**Response:**
```json
{
  "tokens": [
    "ExponentPushToken[xxxxxxxxxxxxx]",
    "ExponentPushToken[yyyyyyyyyyyyy]"
  ],
  "count": 2
}
```

---

### Delete Token
```
DELETE /api/v1/notifications/tokens/{token}
```

**Example:**
```
DELETE /api/v1/notifications/tokens/ExponentPushToken[xxxxxxxxxxxxx]
```

---

### Notify New Monitor Discovered
Called by powermon4 when it sees a MAC address that isn't in the database. Sends a push notification to all registered tokens so a user can tap through to add the monitor.
```
POST /api/v1/monitors/notify-discovered
Content-Type: application/json
```

**Request:**
```json
{
  "mac": "AA:BB:CC:DD:EE:FF"
}
```

**Response:**
```json
{
  "status": "notification sent"
}
```

**Errors:**
- `400` — `mac` field missing or empty

**Note:** Tokens without a `device_name` are skipped (they cannot have mute preferences). The notification `data` payload includes `"notification_type": "new_monitor"` and `"mac": "AA:BB:CC:DD:EE:FF"` so the app can deep-link to the Add Monitor page with the MAC pre-filled.

---

## 🔐 Authentication

All auth endpoints use **Argon2id** for password hashing and **JWT (HS256)** for access tokens.
Refresh tokens are stored server-side and can be revoked via logout.
Password reset uses **itsdangerous** time-safe tokens (valid for 1 hour).

### Register
```
POST /api/v1/auth/register
Content-Type: application/json
```

**Request:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "s3curepa$$"
}
```

**Response (200):**
```json
{
  "status": "created",
  "user": { "id": 1, "username": "alice", "email": "alice@example.com" }
}
```

**Error (400):**
```json
{ "detail": { "status": "weak_password" } }
```
```json
{ "detail": { "status": "duplicate", "reason": "..." } }
```

**Notes:**
- Password must be at least 8 characters
- Username and email must be unique

---

### Login
```
POST /api/v1/auth/login
Content-Type: application/json
```

**Request:**
```json
{ "username": "alice", "password": "s3curepa$$" }
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "bearer"
}
```

**Error (401):**
```json
{ "detail": { "status": "invalid_credentials" } }
```

**Notes:**
- Access token expires after 15 minutes (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Refresh token expires after 7 days (configurable via `REFRESH_TOKEN_EXPIRE_DAYS`)

---

### Refresh Access Token
```
POST /api/v1/auth/refresh
Content-Type: application/json
```

**Request:**
```json
{ "refresh_token": "abc123..." }
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "bearer"
}
```

**Error (401):**
```json
{ "detail": { "status": "invalid_refresh" } }
```

---

### Logout
```
POST /api/v1/auth/logout
Content-Type: application/json
```

**Request:**
```json
{ "refresh_token": "abc123..." }
```

**Response (200):**
```json
{ "status": "logged_out" }
```

**Notes:**
- Deletes the refresh token server-side so it cannot be reused

---

### Delete Account
```
DELETE /api/v1/auth/account
Authorization: Bearer <access_token>
```

**Request:**
No body required

**Response (200):**
```json
{ "status": "deleted" }
```

**Error Responses:**

*Unauthorized (401):*
```json
{ "detail": "Not authenticated" }
```

*Server Error (500):*
```json
{ "detail": { "status": "delete_failed" } }
```

**Notes:**
- Requires authentication via Bearer token
- Permanently deletes the user account and all associated refresh tokens
- This action cannot be undone
- The user will need to register a new account to use the system again

---

### Forgot Password
```
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

**Request:**
```json
{ "email": "alice@example.com" }
```

**Response (200):**
```json
{ "status": "ok" }
```

**Notes:**
- Always returns `{ "status": "ok" }` whether or not the email exists (prevents user enumeration).
- The reset code is **never** returned in the API response — it's emailed to the user via SMTP. (Previously the endpoint leaked the code; that was an account-takeover hole. Fixed.)
- Reset code is generated using `itsdangerous.URLSafeTimedSerializer` and is valid for 1 hour.
- The email body contains a deep link `powermon://resetPassword?code=...` plus the raw code as a fallback.
- SMTP delivery is best-effort: the endpoint returns success even if the email fails to send (so a broken SMTP doesn't leak which addresses are registered). Operators can grep `journalctl` for `[email]` lines to debug delivery.

---

### Reset Password
```
POST /api/v1/auth/reset-password
Content-Type: application/json
```

**Request:**
```json
{ "reset_code": "...", "new_password": "newPa$$w0rd" }
```

**Response (200):**
```json
{ "status": "ok" }
```

**Error (400):**
```json
{ "detail": { "status": "invalid_or_expired_code" } }
```
```json
{ "detail": { "status": "weak_password" } }
```

**Notes:**
- Reset codes are single-use; consumed on successful reset
- New password must be at least 8 characters

---

### Get Current User
```
GET /api/v1/auth/me
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{ "id": 1, "username": "alice", "email": "alice@example.com" }
```

**Error (401):**
```json
{ "detail": "Token expired" }
```
```json
{ "detail": "Invalid authentication token" }
```

**Notes:**
- Requires a valid JWT access token in the `Authorization: Bearer` header

---

## 🔕 Mute Preferences (Per-Device)

### Get Muted Machines
```
GET /api/v1/muted-machines?device_id={device_id}
```

**Example:**
```
GET /api/v1/muted-machines?device_id=johns_phone
```

**Response:**
```json
{
  "device_id": "johns_phone",
  "muted_machines": ["Pump 1", "Pump 3"]
}
```

---

### Mute a Machine
```
POST /api/v1/muted-machines
Content-Type: application/json
```

**Request:**
```json
{
  "device_id": "johns_phone",
  "machine_name": "Pump 1"
}
```

**Response:**
```json
{
  "status": "added",
  "device_id": "johns_phone",
  "machine_name": "Pump 1"
}
```

---

### Unmute a Machine
```
DELETE /api/v1/muted-machines?device_id={device_id}&machine_name={machine_name}
```

**Example:**
```
DELETE /api/v1/muted-machines?device_id=johns_phone&machine_name=Pump%201
```

**Response:**
```json
{
  "status": "removed",
  "device_id": "johns_phone",
  "machine_name": "Pump 1"
}
```

---

### Sync All Muted Machines (Bulk Update)
```
PUT /api/v1/muted-machines
Content-Type: application/json
```

**Request:**
```json
{
  "device_id": "johns_phone",
  "machine_names": ["Pump 1", "Pump 3", "Compressor 2"]
}
```

**Response:**
```json
{
  "status": "replaced",
  "device_id": "johns_phone",
  "muted_machines": ["Pump 1", "Pump 3", "Compressor 2"]
}
```

**Use Case:** When app comes online after being offline, sync the entire muted list

---

## 🎛️ Monitors

### List All Monitors
```
GET /api/v1/monitors
```

**Response:**
```json
[
  {
    "mac": "AA:BB:CC:DD:EE:FF",
    "id": 123,
    "name": "Pump 1"
  },
  {
    "mac": "BB:CC:DD:EE:FF:00",
    "id": 124,
    "name": null
  }
]
```

**Note:** `name: null` means the monitor is unassigned

---

### Create Monitor
```
POST /api/v1/monitors
Content-Type: application/json
```

**Request:**
```json
{
  "id": 125,
  "mac": "CC:DD:EE:FF:00:11",
  "machine_name": "Pump 5"
}
```

**Response (201):**
```json
{
  "status": "created",
  "monitor": {
    "id": 125,
    "mac": "CC:DD:EE:FF:00:11",
    "machine_name": "Pump 5"
  }
}
```

---

### Update Monitor
```
PUT /api/v1/monitors/{monitor_id}
Content-Type: application/json
```

**Update a monitor's ID and/or MAC address. All associated poll records will be updated automatically.**

**Request (update MAC only):**
```json
{
  "mac": "DD:EE:FF:00:11:22"
}
```

**Request (update ID only):**
```json
{
  "id": 126
}
```

**Request (update both):**
```json
{
  "id": 126,
  "mac": "DD:EE:FF:00:11:22"
}
```

**Response (200):**
```json
{
  "status": "Monitor updated successfully",
  "monitor": {
    "id": 126,
    "mac": "DD:EE:FF:00:11:22",
    "machine_name": "Pump 5"
  }
}
```

**⚠️ Important:**
- At least one field (id or mac) must be provided
- New MAC and ID must not already exist in the database
- **All poll records** referencing the old MAC will be automatically updated to the new MAC
- This ensures historical power data stays with the correct monitor

---

### Reassign Monitor
```
POST /api/v1/monitors/{monitor_id}/reassign?machine_name={machine_name}
```

**Example:**
```
POST /api/v1/monitors/123/reassign?machine_name=Pump%206
```

**Response:**
```json
{
  "status": "Monitor 123 reassigned to Pump 6",
  "monitor_id": 123,
  "machine_name": "Pump 6"
}
```

---

### Unassign Monitor
```
POST /api/v1/monitors/{monitor_id}/unassign
```

**Response:**
```json
{
  "status": "Monitor 123 unassigned successfully",
  "monitor_id": 123
}
```

---

### Delete Monitor
```
DELETE /api/v1/monitors/{monitor_id}
```

**Permanently delete a monitor from the database.**

**Response (200):**
```json
{
  "status": "Monitor 123 deleted successfully",
  "monitor_id": 123
}
```

**Error Response (400):**
```json
{
  "detail": "Cannot delete monitor with associated poll data. Use unassign endpoint instead to preserve historical data."
}
```

**⚠️ Important:**
- Monitors with associated poll data cannot be deleted
- Use the unassign endpoint instead to preserve historical data
- Only delete monitors that have never recorded any data
- Consider unassigning instead of deleting in most cases

---

## 📍 Locations & Types

### Get All Locations
```
GET /api/v1/locations
```

**Response:**
```json
["Building 1", "Building 2", "Warehouse", "Lab"]
```

---

### Get All Machine Types
```
GET /api/v1/machine_types
```

**Response:**
```json
["Pump", "Compressor", "Motor", "Blender"]
```

---

## ❤️ Health Check

### Server Health
```
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

---

## 🌫️ Vacuum Monitoring

All vacuum endpoints sit under `/api/v1/vacuum/`. The data model mirrors the power side: `VacSystem` (PK = system_name) → `VacMonitor` (PK = mac) → `VacPoll`. Calibration (m=1.466, c=0.209) is applied to every `last_pressure` and graph point on the way out — DB stores raw Pirani readings.

### List Vacuum Devices
```
GET /api/v1/vacuum/status?location=&status=
GET /api/v1/vacuum/devices
GET /api/v1/vacuum/devices/{mac}
```
`/status` returns each device with computed status (`online` / `offline` / `vacuum loss`), calibrated `last_pressure`, and `alerts_paused_until` (UTC ISO string or `null` — see *Pause Vacuum Alerts* below). `/devices/{mac}` is the detail variant used by the mobile app and returns the same field.

### Pause Vacuum Alerts
```
POST   /api/v1/vacuum/{mac}/pause-alerts          # body: {minutes?: 1..240, default 5}
POST   /api/v1/vacuum/{mac}/pause-alerts/extend   # body: {minutes?: 1..240, default 5}
DELETE /api/v1/vacuum/{mac}/pause-alerts          # resume immediately
```
Suppresses both `vacuum loss` and `vacuum offline` push notifications for the system that owns this monitor for the requested window. Used when someone is working on the system and intentionally breaking vacuum / disconnecting the monitor. The pause is global (every Expo token sees the suppression), persisted in `vac_system.alerts_paused_until`, and surfaces in the `/status` and `/devices/{mac}` responses so the mobile app can show a live countdown.

**Extend** adds `minutes` to the current `paused_until` (stacking, so repeated calls keep pushing the resume time out). If there's no active pause it falls back to a fresh pause from now.

**Resume behaviour:** `vac_alert_monitor` keeps paused systems in its in-memory `alerted_systems` set across the pause window, so if the system is *still* in the same alert state it was in before the pause (or first observed during the pause), **no** notification fires when the pause expires — the user already saw the alert. Genuinely new alert conditions that surface only after the pause ends still fire normally.

### Vacuum Stats
```
GET /api/v1/vacuum/device_stats
Response: {"online": 2, "offline": 1, "vacuum_loss": 0}
```

### Pressure History (graph)
```
GET /api/v1/vacuum/pressure?mac=...&time_range=...&bucket=...
```

**Valid `time_range` values:** `5m`, `10m`, `30m`, `1h`, `3h`, `6h`, `12h`, `24h`, `3d`, `7d`, `30d`.
**Valid `bucket` values:** `10s`, `20s`, `30s`, `1m`, `2m`, `5m`, `10m`, `30m`, `1h`, `4h`, `12h`, `1d`.

**Response shape:**
```json
{
  "mac": "...",
  "time_range": "30d",
  "bucket": "1h",
  "points": [
    { "date": "2026-05-20T10:00:00Z",
      "value": 0.4612,   // bucket mean (calibrated mbar)
      "min": 0.4321,     // smallest calibrated reading in the bucket
      "max": 1.8734 }    // largest calibrated reading in the bucket — useful for spike detection
  ],
  "min": 0.4,        // top-level summary: min across raw polls
  "max": 2.1,        // top-level summary: max across raw polls
  "average": 0.51
}
```

`value` is the per-bucket mean (used by the mobile app's existing line graph). `min` and `max` are emitted per-bucket so spike-preserving renderings (band charts, candlesticks) can be built without losing transient events to averaging — important for long-time-range views like the planned web-app monthly graph where a 1-hour bucket would otherwise smooth a 5-minute vacuum-loss spike into invisibility. All four values are calibrated mbar.

The **top-level** `min` / `max` / `average` are computed from the raw polls within the window (not from the bucket aggregates), so they're consistent across `time_range` / `bucket` choices.

### Vacuum Systems CRUD
```
GET    /api/v1/vacuum/systems                  # [{name, location, monitor_count}]
POST   /api/v1/vacuum/systems                  # body: {name, location?}
PUT    /api/v1/vacuum/systems/{name}           # body: {name?, location?} — name change cascades to monitors and poll history (deferred FK)
DELETE /api/v1/vacuum/systems/{name}
```

### Vacuum Monitors CRUD
```
GET    /api/v1/vacuum/monitors                 # [{id, mac, name, system_name}]
POST   /api/v1/vacuum/monitors                 # body: {id, mac, name?, system_name?}
PUT    /api/v1/vacuum/monitors/{id}            # body: {name?, system_name?}
                                                #   value sets, "" clears, absent leaves alone
DELETE /api/v1/vacuum/monitors/{id}            # cascades polls
POST   /api/v1/vacuum/monitors/{id}/reassign?system_name=...
POST   /api/v1/vacuum/monitors/{id}/unassign
POST   /api/v1/vacuum/monitors/notify-discovered  # called by powermon4 on unknown MAC
```

**Multi-gauge per system.** A `VacSystem` can host multiple `VacMonitor` rows; each gauge has its own `name` (e.g. "Inlet", "Chamber"). `GET /api/v1/vacuum/status` returns one entry per system with a `gauges: [{mac, id, name, last_seen, last_pressure}, ...]` array; the top-level `mac` / `last_pressure` / `last_seen` mirror the primary gauge (lowest id) for backward compatibility.

### Polls (data ingestion)
```
POST /api/v1/vacuum/polls
Body: {monitor_mac, pressure_mbar, voltage, poll_time?}
```

---

## 📜 Notification History (April 2026)

Server-side log of every push, with per-user dismissals. All endpoints require `Authorization: Bearer <access_token>`. See [EXPO_NOTIFICATIONS_GUIDE.md](EXPO_NOTIFICATIONS_GUIDE.md) for the channel/severity setup on the mobile side.

### Get Notification History
```
GET /api/v1/notifications/history?device_id=<deviceName>
```
Returns active (undismissed) notifications for the logged-in user, newest first, last 30 days.

When `device_id` is provided, alerts the device has muted — by severity (`mute_critical` / `mute_warning` on `NotificationToken`) or by machine (`DeviceMutePreference.muted_machines`) — are filtered out.

```json
[
  {
    "id": 1234,
    "title": "Machine Alert",
    "body": "Power Loss: Pump 2",
    "createdAt": "2026-04-29T10:11:24+00:00",
    "data": {
      "severity": "critical",
      "type": null,
      "machines": ["Pump 2"],
      "mac": "AA:BB:CC:11:22:06",
      "notification_mac": null,
      "createdAt": "2026-04-29T10:11:24+00:00",
      "notification_id": 1234
    }
  }
]
```

### Dismiss Single Notification
```
POST /api/v1/notifications/{notification_id}/dismiss
Response: {"status": "dismissed"}
```
Idempotent. Returns `404` only if the notification doesn't exist (e.g. purged > 30 days old).

### Dismiss All Active Notifications
```
POST /api/v1/notifications/dismiss-all
Response: {"status": "dismissed", "count": 7}
```

### Push Payload Additions
Every Expo message now includes:
- `channelId` — `"critical"`, `"warning"`, or `"default"` (Android only, picks the matching channel for sound/importance)
- `data.notification_id` — integer id used by the mobile app to dedupe between push delivery and history fetch

---

## 🚨 Error Responses

All error responses follow this format:

```json
{
  "detail": {
    "status": "error",
    "reason": "Descriptive error message"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | When It Happens |
|------|---------|-----------------|
| 200 | OK | Success |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid data or parameters |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation error |
| 500 | Internal Server Error | Server problem |

---

## 💡 Mobile App Tips

### 1. Device Deletion
```javascript
async function deleteDevice(device) {
  if (device.mac === null) {
    return await DELETE(`/api/v1/machines/${encodeURIComponent(device.name)}`);
  } else {
    return await DELETE(`/api/v1/devices/${encodeURIComponent(device.mac)}`);
  }
}
```

### 2. Creating Devices
```javascript
// When creating a device, you can safely send id: 0 and mac: ""
// The server will normalize them to null
const payload = {
  name: deviceName,
  id: monitorId || 0,  // 0 = no monitor ID
  mac: monitorMac || "",  // "" = no MAC
  machine_type: machineType,
  location: location
};
```

### 3. Polling for Updates
```javascript
// Poll every 2 seconds for device status
setInterval(async () => {
  const devices = await GET('/api/v1/devices');
  updateUI(devices);
}, 2000);
```

### 4. Handling Notifications
```javascript
// Register token with device ID
await POST('/api/v1/notifications/register', {
  token: pushToken,
  device_name: deviceId  // Save this locally!
});

// Use same device_name for mute preferences
await POST('/api/v1/muted-machines', {
  device_id: deviceId,
  machine_name: machineName
});
```

---

## 📝 Quick Reference

**Authentication:**
- Register: `POST /api/v1/auth/register`
- Login: `POST /api/v1/auth/login`
- Refresh: `POST /api/v1/auth/refresh`
- Logout: `POST /api/v1/auth/logout`
- Forgot password: `POST /api/v1/auth/forgot-password`
- Reset password: `POST /api/v1/auth/reset-password`
- Current user: `GET /api/v1/auth/me` (requires `Authorization: Bearer <token>`)
- Delete account: `DELETE /api/v1/auth/account` (requires `Authorization: Bearer <token>`)

**Base CRUD:**
- List: `GET /api/v1/devices`
- Get One: `GET /api/v1/devices/{mac}` or `GET /api/v1/machines/{name}`
- Create: `POST /api/v1/devices`
- Update: `PUT /api/v1/devices/{mac}`
- Delete: `DELETE /api/v1/devices/{mac}` or `DELETE /api/v1/machines/{name}`

**Monitor Operations:**
- List: `GET /api/v1/monitors`
- Create: `POST /api/v1/monitors`
- Update: `PUT /api/v1/monitors/{monitor_id}` (updates MAC/ID and all associated polls)
- Reassign: `POST /api/v1/monitors/{monitor_id}/reassign?machine_name={name}`
- Unassign: `POST /api/v1/monitors/{monitor_id}/unassign`
- Delete: `DELETE /api/v1/monitors/{monitor_id}` (only if no poll data exists)

**Poll Data:**
- Get History: `GET /api/v1/power?mac={mac}&time_range={range}&bucket={bucket}`
- Insert: `POST /api/v1/polls` (for external data sources)

**Vacuum:**
- Status: `GET /api/v1/vacuum/status`
- Stats: `GET /api/v1/vacuum/device_stats`
- Pressure history: `GET /api/v1/vacuum/pressure?mac=...&time_range=...&bucket=...`
- Systems: `GET|POST /api/v1/vacuum/systems`, `PUT|DELETE /api/v1/vacuum/systems/{name}`
- Monitors: `GET|POST /api/v1/vacuum/monitors`, `DELETE /api/v1/vacuum/monitors/{id}`, `POST .../reassign`, `POST .../unassign`

**Notification History (auth required):**
- List active for user: `GET /api/v1/notifications/history?device_id=...`
- Dismiss one: `POST /api/v1/notifications/{id}/dismiss`
- Dismiss all: `POST /api/v1/notifications/dismiss-all`

**Notification preferences** (`GET|PUT /api/v1/notifications/preferences`) — the response/body shape now includes `anomaly_optin: bool` alongside `mute_critical` and `mute_warning`. Anomaly pushes (`severity="anomaly"`) are **opt-in per device**: default `false`, and `send_expo_notification` silently drops anomaly pushes for any token whose owner hasn't enabled it. Critical and warning routing is unchanged.

**ML Anomaly Detection:**
- Activate a power machine (start collecting): `POST /api/v1/ml/machines/{machine_name}/activate`
- Deactivate (back to standby, discards model): `DELETE /api/v1/ml/machines/{machine_name}/activate`
- Activate a vacuum system: `POST /api/v1/ml/vacuum/{system_name}/activate`
- Deactivate a vacuum system: `DELETE /api/v1/ml/vacuum/{system_name}/activate`
- List all ML rows (both kinds, all states): `GET /api/v1/ml/status`

Each ML row goes through `standby → collecting → active`. Activation just flips `standby → collecting` and records `collection_start_time`; the background `ml_retrain_loop` (hourly) trains an Isolation Forest for power machines and a slope-distribution baseline for vacuum systems once enough polls have accumulated *after* `collection_start_time`, then flips the row to `active` and starts emitting `severity="anomaly"` push notifications (channel `anomaly` on Android) when 3 consecutive polls fall outside the learned distribution. Active models retrain every 7 days, capped at the most recent 200 000 polls to bound memory. Activating again on an already-collecting/active row is idempotent and does not reset the clock.

**Always URL encode:**
- Machine names with spaces
- MAC addresses (though : is usually safe)
- Any special characters in query parameters

**Device ID for notifications:**
- Use the same `device_name` you registered with your push token
- Store it locally in your app
- Use it for all mute preference operations

---

**Questions?** Check ARCHITECTURE_DIAGRAM.md for detailed system architecture and implementation details.
