# Deployment Checklist - Device Mute Preferences

## Pre-Deployment

### Development Environment
- [x] Database model created (`DeviceMutePreference`)
- [x] Database functions implemented in `db.py`
- [x] API endpoints implemented in `app.py`
- [x] Notification filtering logic updated
- [x] Pydantic models created
- [x] Migration script created
- [x] Setup script created
- [x] Test suite created
- [x] Documentation written
 - [x] User account models and auth endpoints added
 - [x] Password hashing (Argon2id) and JWT auth configured
 - [x] Forgot-password / reset-password flow (itsdangerous tokens)
 - [x] Refresh token storage and revocation on logout

### Testing
- [ ] Run automated tests: `python3 test_mute_preferences.py`
- [ ] Manual API testing completed
- [ ] Notification filtering tested with real devices
- [ ] Multiple device scenarios tested
- [ ] Edge cases tested (non-existent machines, empty lists, etc.)
- [ ] Database performance verified
 - [x] Run auth tests: `pytest test_auth.py test_hash_helpers.py`
 - [x] Verify password reset flow (single-use codes, old password invalidated)

### Code Review
- [ ] All code changes reviewed
- [ ] No hardcoded credentials
- [ ] Error handling implemented
- [ ] Logging in place
- [ ] SQL injection prevention verified
- [ ] Input validation implemented

## Deployment

### Database
- [ ] Backup current database: `pg_dump your_db > backup_$(date +%Y%m%d).sql`
- [ ] Run migration script: `python3 create_mute_preferences_table.py`
- [ ] Verify table created: `psql -c "\d device_mute_preferences"`
- [ ] Verify index created: `psql -c "\d device_mute_preferences_pkey"`
- [ ] Test database connection from app

### Application Server
- [ ] Pull latest code to production server
- [ ] Update Python dependencies if needed
- [ ] Restart application server
- [ ] Verify server starts without errors
- [ ] Check logs for any startup issues
- [ ] Verify all endpoints are accessible

### API Testing
- [ ] Test GET endpoint: `curl http://your-server/api/devices/test/muted-machines`
- [ ] Test POST endpoint (add muted machine)
- [ ] Test DELETE endpoint (remove muted machine)
- [ ] Test PUT endpoint (bulk replace)
- [ ] Verify error responses (404 for non-existent machines)
- [ ] Test with special characters in device_id/machine_name
 - [ ] Test auth: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `GET /api/v1/auth/me`
 - [ ] Test forgot/reset password: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
 - [ ] Verify logout invalidates refresh token
 - [ ] Verify expired access tokens are rejected

### Notification Testing
- [ ] Register test device with notification token
- [ ] Mute a machine for test device
- [ ] Trigger alert for that machine
- [ ] Verify test device does NOT receive notification
- [ ] Verify other devices DO receive notification
- [ ] Unmute and verify notifications resume

## Mobile App Integration

### Backend Ready
- [ ] API endpoints documented and shared with mobile team
- [ ] API examples provided
- [ ] Device ID strategy defined and communicated
- [ ] Error handling documented

### Mobile App Development
- [ ] Add mute toggle UI to machine list/details
- [ ] Implement API integration
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success feedback (toasts/snackbars)
- [ ] Implement offline caching (optional)
- [ ] Add settings page for managing mutes

### Mobile App Testing
- [ ] Test muting a machine
- [ ] Test unmuting a machine
- [ ] Test with no network (error handling)
- [ ] Test notification behavior
- [ ] Test multiple devices simultaneously
- [ ] Test app reinstall (preferences persist)
- [ ] Test bulk sync on app launch

## Monitoring

### Initial Monitoring (First 24 Hours)
- [ ] Monitor server logs for errors
- [ ] Check database query performance
- [ ] Monitor API response times
- [ ] Verify notification delivery rates
- [ ] Check for any unexpected errors
- [ ] Monitor database growth

### Metrics to Track
- [ ] Number of devices with mute preferences
- [ ] Number of muted machines per device (average)
- [ ] Most frequently muted machines
- [ ] API endpoint usage (calls per hour)
- [ ] Notification skip rate
- [ ] Error rate for mute operations

### Performance Checks
- [ ] Database query times < 100ms
- [ ] API response times < 200ms
- [ ] No memory leaks
- [ ] No database connection leaks
- [ ] Notification batch processing time acceptable

## Rollback Plan

### If Issues Occur

1. **Critical Issues (Notifications Broken)**
   ```bash
   # Revert code changes
   git revert <commit-hash>
   
   # Restart server
   systemctl restart your-app
   ```

2. **Database Issues**
   ```sql
   -- Drop table if causing problems (won't affect other features)
   DROP TABLE IF EXISTS device_mute_preferences CASCADE;
   
   -- Restore from backup if needed
   psql your_db < backup_YYYYMMDD.sql
   ```

3. **Partial Rollback (Keep Table, Disable Feature)**
   - Comment out mute checking in `send_expo_notification()`
   - Keep API endpoints (won't hurt if unused)
   - Mobile app can continue using endpoints

### Rollback Checklist
- [ ] Identify issue severity
- [ ] Backup current state before rollback
- [ ] Execute rollback steps
- [ ] Verify system returns to working state
- [ ] Document what went wrong
- [ ] Plan fix for next deployment

## Post-Deployment

### User Communication
- [ ] Announce feature to users
- [ ] Provide usage instructions
- [ ] Share mobile app update (when ready)
- [ ] Gather user feedback

### Documentation
- [ ] Update main README if needed
- [ ] Update API documentation
- [ ] Create user guide for mobile app
- [ ] Document any deployment issues encountered

### Follow-Up (1 Week Later)
- [ ] Review metrics and usage
- [ ] Check for any reported issues
- [ ] Verify performance is stable
- [ ] Plan any needed improvements
- [ ] Consider additional features based on usage

## Success Criteria

✅ All items checked means successful deployment!

### Must Have (Before Going Live)
- ✅ Database table created successfully
- ✅ All API endpoints working
- ✅ Automated tests passing
- ✅ Notification filtering working correctly
- ✅ No errors in production logs

### Nice to Have (Can be gradual)
- ⏳ Mobile app updated with mute UI
- ⏳ Users actively using mute feature
- ⏳ Metrics dashboard showing usage
- ⏳ Positive user feedback

## Notes

### Deployment Date: _____________

### Deployed By: _____________

### Issues Encountered:
```
(Document any issues here)
```

### Metrics After 24 Hours:
```
- Devices with preferences: ____
- Total muted machines: ____
- API calls (POST): ____
- API calls (GET): ____
- API calls (DELETE): ____
- API calls (PUT): ____
- Notification skip rate: ____%
```

### Action Items:
- [ ] _________________________________
- [ ] _________________________________
- [ ] _________________________________

---

**Checklist Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Ready for Deployment
