# ManageMonitorCard Implementation Guide

## Overview
This document outlines the API endpoints and implementation details needed to complete the ManageMonitorCard component functionality.

## Current State
The ManageMonitorCard component displays:
- Monitor ID
- MAC Address
- Assigned Machine Name
- Edit button (not functional)
- Remove button (not functional)

## Required API Endpoints

### 1. Edit Monitor - Reassign to Different Machine
**Purpose**: Change which machine a monitor is assigned to

**Endpoint**: `POST /api/v1/monitors/{monitor_id}/reassign`

**Query Parameters**:
- `machine_name` (string): The name of the machine to assign the monitor to

**Example Request**:
```
POST /api/v1/monitors/5/reassign?machine_name=Pump%203
Content-Type: application/json
```

**Expected Response** (200 OK):
```json
{
  "status": "Monitor 5 reassigned to Pump 3",
  "monitor_id": 5,
  "machine_name": "Pump 3"
}
```

**Error Response** (404):
```json
{
  "detail": "Monitor with id 5 not found"
}
```

**Error Response** (400):
```json
{
  "detail": "Machine 'Pump 3' not found"
}
```

---

### 2. Delete Monitor (Unassign from Machine)
**Purpose**: Remove a monitor from its assigned machine (keeps monitor in system but unassigns it)

**Endpoint**: `POST /api/v1/monitors/{monitor_id}/unassign`

**Example Request**:
```
POST /api/v1/monitors/5/unassign
Content-Type: application/json
```

**Expected Response** (200 OK):
```json
{
  "status": "Monitor 5 unassigned successfully",
  "monitor_id": 5
}
```

**Error Response** (404):
```json
{
  "detail": "Monitor with id 5 not found"
}
```

---

### 3. Delete Monitor Completely (Optional - if you want full deletion)
**Purpose**: Completely remove a monitor from the system

**Endpoint**: `DELETE /api/v1/monitors/{monitor_id}`

**Example Request**:
```
DELETE /api/v1/monitors/5
Content-Type: application/json
```

**Expected Response** (200 OK):
```json
{
  "status": "Monitor 5 deleted successfully",
  "monitor_id": 5
}
```

**Error Response** (404):
```json
{
  "detail": "Monitor with id 5 not found"
}
```

---

## Implementation Details

### Edit Functionality
The Edit button will:
1. Navigate to an edit screen showing the monitor details
2. Allow selecting a different machine from a dropdown
3. Call the reassign API endpoint when saved
4. Show success/error alerts
5. Refresh the monitor list

### Delete/Remove Functionality
The Remove button will:
1. Show a confirmation alert
2. Offer two options:
   - "Unassign" - removes monitor from machine but keeps it in system
   - "Delete Permanently" - completely removes monitor
3. Call the appropriate API endpoint
4. Show success/error alerts
5. Refresh the monitor list

### Error Handling
- Network errors: Show user-friendly error messages
- 404 errors: "Monitor not found"
- 400 errors: Show the specific error message from API
- Success: Show confirmation and refresh list

## Component Props
```javascript
ManageMonitorCard({
  monitor: {
    id: number,           // Monitor ID
    mac: string,          // MAC address
    name: string,         // Assigned machine name (or null if unassigned)
    machine_name: string  // Alternative field name for machine
  },
  onDelete: function      // Callback after successful delete/unassign
})
```

## Navigation Requirements
For Edit functionality, you may want to create a new screen:
- `/editMonitor` - Screen for editing monitor assignment
- Pass monitor ID as parameter
- Load available machines list
- Show current assignment
- Allow selection of new machine

## Related Files to Update
1. `/components/ManageMonitorCard.jsx` - Add button handlers
2. `/app/manageMonitors.jsx` - Already implemented (fetches monitor list)
3. `/app/editMonitor.jsx` - New file (optional, for edit screen)

## Testing Checklist
- [ ] Edit button navigates to edit screen
- [ ] Can reassign monitor to different machine
- [ ] Remove button shows confirmation dialog
- [ ] Unassign removes monitor from machine
- [ ] Delete permanently removes monitor from system
- [ ] Error messages display correctly
- [ ] Success messages display correctly
- [ ] Monitor list refreshes after changes
- [ ] Loading states show during API calls
- [ ] Network errors handled gracefully
