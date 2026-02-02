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
