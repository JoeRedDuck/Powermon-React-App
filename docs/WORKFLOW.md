# ManageMonitorCard - Visual Workflow

## Component Hierarchy
```
manageMonitors.jsx (Screen)
    └── ManageMonitorCard (Component) x N
            ├── Monitor ID Display
            ├── MAC Address Display
            ├── Assigned Machine Display
            ├── Edit Button → handleEdit()
            └── Remove Button → handleRemove()
                    ├── Unassign → unassignMonitor()
                    └── Delete → deleteMonitor()
```

## User Flow - Remove Button

```
User taps "Remove"
        ↓
Confirmation Dialog Shows
        ↓
    ┌───────┴───────┐
    ↓               ↓
Unassign        Delete
    ↓               ↓
POST /unassign  DELETE /monitor
    ↓               ↓
Remove from     Remove from
machine only    system entirely
    ↓               ↓
    └───────┬───────┘
            ↓
    Success Alert
            ↓
    Refresh List
            ↓
    Updated UI
```

## User Flow - Edit Button (Current)

```
User taps "Edit"
        ↓
Alert Dialog Shows
        ↓
"To edit monitor X, you need to:
1. Create edit screen
2. Load available machines
3. Call reassign API"
        ↓
User taps "OK"
        ↓
Nothing happens
(waiting for edit screen to be built)
```

## User Flow - Edit Button (Future)

```
User taps "Edit"
        ↓
Navigate to editMonitor.jsx
        ↓
Load monitor details
        ↓
Fetch available machines
        ↓
Display dropdown with machines
        ↓
User selects new machine
        ↓
User taps "Save"
        ↓
POST /monitors/X/reassign?machine_name=Y
        ↓
Success Alert
        ↓
Navigate back
        ↓
List refreshes automatically
```

## API Call Flow - Unassign

```
[App] ManageMonitorCard.unassignMonitor()
        ↓
[HTTP] POST /api/v1/monitors/5/unassign
        ↓
[Backend] Process unassignment
        ↓
[Backend] Update database
        ↓
[HTTP] 200 OK Response
        {
          "status": "Monitor 5 unassigned successfully",
          "monitor_id": 5
        }
        ↓
[App] Alert.alert("Success", "Monitor 5 has been unassigned")
        ↓
[App] onDelete(5) callback
        ↓
[App] Parent refreshes list
        ↓
[UI] Updated monitor list displayed
```

## API Call Flow - Delete

```
[App] ManageMonitorCard.deleteMonitor()
        ↓
[HTTP] DELETE /api/v1/monitors/5
        ↓
[Backend] Verify monitor exists
        ↓
[Backend] Delete from database
        ↓
[HTTP] 200 OK Response
        {
          "status": "Monitor 5 deleted successfully",
          "monitor_id": 5
        }
        ↓
[App] Alert.alert("Success", "Monitor 5 has been permanently deleted")
        ↓
[App] onDelete(5) callback
        ↓
[App] Parent refreshes list
        ↓
[UI] Monitor removed from list
```

## Error Flow

```
[App] API call initiated
        ↓
[HTTP] Request sent
        ↓
[Backend] Error occurs (404, 400, 500, etc.)
        ↓
[HTTP] Error Response
        {
          "detail": "Monitor with id 5 not found"
        }
        ↓
[App] res.ok === false
        ↓
[App] Extract error message
        ↓
[App] Alert.alert("Error", "Monitor with id 5 not found")
        ↓
[App] setBusy(false)
        ↓
[UI] Buttons re-enabled
```

## State Management

```
Component Mount
        ↓
busy = false
        ↓
User taps button
        ↓
busy = true
buttons disabled
        ↓
API call in progress
        ↓
Response received (success or error)
        ↓
busy = false
buttons enabled
```

## Component States

### Normal State
```
┌─────────────────────────┐
│ Monitor ID: 5           │
│ MAC: C8:C9:A3:1A:F2:DB │
│ Assigned: Pump 1        │
│                         │
│ [Edit]      [Remove]    │
└─────────────────────────┘
```

### Busy State
```
┌─────────────────────────┐
│ Monitor ID: 5           │
│ MAC: C8:C9:A3:1A:F2:DB │
│ Assigned: Pump 1        │
│                         │
│ [Edit]   [Processing...]│
│ (disabled)   (disabled) │
└─────────────────────────┘
```

### Unassigned State
```
┌─────────────────────────┐
│ Monitor ID: 5           │
│ MAC: C8:C9:A3:1A:F2:DB │
│ Assigned: Unassigned    │
│                         │
│ [Edit]      [Remove]    │
└─────────────────────────┘
```

## Dialog Flow - Remove (Native)

```
┌────────────────────────────┐
│      Remove Monitor        │
├────────────────────────────┤
│ Monitor 5 is assigned to   │
│ Pump 1.                    │
│                            │
│ What would you like to do? │
├────────────────────────────┤
│        [Cancel]            │
│    [Unassign Only]         │
│  [Delete Permanently]      │
│      (destructive)         │
└────────────────────────────┘
```

## Dialog Flow - Remove (Web)

```
┌────────────────────────────┐
│ Do you want to unassign    │
│ Monitor 5?                 │
│                            │
│ This will remove the       │
│ monitor from Pump 1 but    │
│ keep it in the system.     │
├────────────────────────────┤
│    [Cancel]      [OK]      │
└────────────────────────────┘
```

## File Structure

```
Powermon/
├── app/
│   └── manageMonitors.jsx ─────┐ Fetches monitor list
│                                │ Renders ManageMonitorCard for each
│                                │ Handles refresh callback
├── components/
│   └── ManageMonitorCard.jsx ──┤ Displays monitor info
│                                │ Edit button handler
│                                │ Remove button handler
│                                │ API calls (unassign/delete)
└── docs/
    ├── API_Quick_Reference.md ─┤ API endpoint docs
    ├── ManageMonitorCard_Implementation.md
    ├── ManageMonitorCard_Changes.md
    └── SUMMARY.md ──────────────┤ Overall summary
```

## Data Flow

```
Backend API
    ↓
GET /monitors
    ↓
[
  { id: 1, mac: "...", name: "Pump 1" },
  { id: 2, mac: "...", name: "Pump 2" },
  { id: 3, mac: "...", name: null }
]
    ↓
manageMonitors.jsx
    ↓
monitors state array
    ↓
.map() over array
    ↓
Render ManageMonitorCard for each
    ↓
User interacts with card
    ↓
Edit/Remove button tapped
    ↓
API call (unassign/delete)
    ↓
onDelete callback triggered
    ↓
Parent re-fetches monitors
    ↓
Updated UI
```

## Platform Differences

### iOS/Android (Native)
- Uses `Alert.alert()` with multiple buttons
- Supports button styles (cancel, destructive)
- Better user experience with three options

### Web
- Uses browser `confirm()` dialog
- Only supports OK/Cancel
- Simplified to unassign only
- Less ideal but functional

## Security Considerations

### Input Validation
- Monitor ID validated before API call
- Error handling for invalid IDs
- URL encoding for machine names

### Error Messages
- Don't expose internal errors to users
- Generic "An error occurred" for unknown errors
- Specific messages for known cases (404, etc.)

### Loading States
- Prevent double-clicking with busy flag
- Disable buttons during operations
- Visual feedback with opacity changes

## Performance Optimizations

### Refresh Strategy
1. Auto-refresh every 5 seconds (from parent)
2. Manual refresh after mutations
3. Callback pattern avoids prop drilling
4. Unmount cleanup prevents memory leaks

### Network Efficiency
- Only fetch full list on change
- Individual operations by ID
- Error handling prevents unnecessary retries
- Proper timeout handling

## Accessibility

### Screen Readers
- All buttons have accessible labels
- Text content readable
- Alert dialogs announced

### Keyboard Navigation
- Touchable components keyboard accessible
- Tab order logical
- Focus states handled by platform

## Testing Strategy

### Unit Tests Needed
- [ ] Test handleEdit() shows alert
- [ ] Test handleRemove() shows confirmation
- [ ] Test unassignMonitor() calls correct endpoint
- [ ] Test deleteMonitor() calls correct endpoint
- [ ] Test error handling paths
- [ ] Test loading state management

### Integration Tests Needed
- [ ] Test full remove flow
- [ ] Test error scenarios
- [ ] Test network failures
- [ ] Test with real backend

### Manual Tests Required
- [ ] Test on iOS device
- [ ] Test on Android device
- [ ] Test on web browser
- [ ] Test all confirmation dialogs
- [ ] Test success/error alerts
- [ ] Test list refresh

## Future Enhancements

### Phase 1 (Current)
- ✅ Display monitor info
- ✅ Remove button (unassign/delete)
- ✅ Edit button (placeholder)
- ✅ Error handling
- ✅ Loading states

### Phase 2 (Next)
- [ ] Create editMonitor.jsx screen
- [ ] Machine selector dropdown
- [ ] Reassign API integration
- [ ] Form validation
- [ ] Success navigation

### Phase 3 (Future)
- [ ] Bulk operations
- [ ] Filter/search monitors
- [ ] Sort by various fields
- [ ] Export monitor list
- [ ] Monitor status indicators
- [ ] Last seen timestamp
