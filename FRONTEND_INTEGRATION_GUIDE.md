# 🎯 FRONTEND INTEGRATION GUIDE - Quick Reference

## Production API Endpoint

After Vercel deployment, your API will be at:
```
https://bas-backend-XXXXXX.vercel.app
```

Replace `XXXXXX` with your actual Vercel deployment ID.

---

## Frontend Environment Configuration

### Employee Mobile App (.env.production)
```properties
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
REACT_APP_API_TIMEOUT=15000
REACT_APP_API_RETRY_ATTEMPTS=3

# Location
REACT_APP_LOCATION_TIMEOUT=15000
REACT_APP_LOCATION_HIGH_ACCURACY=true
REACT_APP_LOCATION_MAX_AGE=60000

# Heartbeat - IMPORTANT: Must match backend!
REACT_APP_HEARTBEAT_INTERVAL=300000
REACT_APP_HEARTBEAT_MAX_FAILURES=3
```

### Admin Dashboard (.env.production)
```properties
REACT_APP_API_BASE_URL=https://bas-backend-XXXXXX.vercel.app
REACT_APP_API_TIMEOUT=15000
REACT_APP_API_RETRY_ATTEMPTS=3
```

---

## ⚙️ Backend Configuration Reference

Your backend is configured with:
- **Session Timeout**: 8 hours
- **Heartbeat Interval**: 5 minutes (300,000 ms)
- **Auto-Logout Check**: 10 minutes
- **Location Proximity**: 3,000 meters

**Frontend heartbeat must send every 5 minutes or less!**

---

## 🔄 Updated Verify Session Response

The `/api/auth/verify-session` endpoint now includes timing information:

```json
{
  "ok": true,
  "valid": true,
  "session": {
    "sessionId": "...",
    "userId": "...",
    "deviceId": "...",
    "loginAt": "2025-10-17T09:00:00.000Z",
    "lastHeartbeat": "2025-10-17T09:45:30.000Z",
    "timeSinceLastHeartbeatMs": 15000,  // ← NEW!
    "status": "active"
  },
  "user": { ... },
  "expiresIn": 42300
}
```

### Frontend Usage Example:
```javascript
const response = await verifySession(sessionId);

if (response.valid) {
  const timeSinceLastHeartbeat = response.session.timeSinceLastHeartbeatMs;
  const heartbeatInterval = 300000; // 5 minutes
  
  // Calculate next heartbeat delay
  const nextHeartbeatDelay = Math.max(0, heartbeatInterval - timeSinceLastHeartbeat);
  
  // Schedule next heartbeat
  setTimeout(() => sendHeartbeat(), nextHeartbeatDelay);
}
```

---

## 📋 API Endpoints Summary

### Authentication
```javascript
POST /api/auth/login
POST /api/auth/verify-session  // ← Returns timeSinceLastHeartbeatMs
POST /api/auth/logout
```

### Heartbeat
```javascript
POST /api/heartbeat
// Now validates session expiry
```

### Sessions
```javascript
GET /api/sessions?skip=0&limit=50&companyId=...&userId=...&from=...&to=...
GET /api/user-work-report?userId=...&type=daily|weekly|monthly|yearly&date=...
GET /api/export?companyId=...&from=...&to=...&format=csv
```

### Users
```javascript
GET /api/users?companyId=...&role=...
GET /api/users/:id
POST /api/users
POST /api/users/create-admin
PUT /api/users/:id
DELETE /api/users/:id
GET /api/users/available-devices/:companyId
```

### Devices
```javascript
POST /api/device/register
GET /api/device?companyId=...
DELETE /api/device/:id
```

### Locations
```javascript
POST /api/locations
GET /api/locations?companyId=...
POST /api/locations/delete  // Body: { "id": "..." }
```

### Companies
```javascript
POST /api/companies
GET /api/companies
GET /api/companies/:id
PUT /api/companies/:id
```

### Attendance
```javascript
GET /api/attendance/daily?companyId=...&date=...
GET /api/attendance/monthly?companyId=...&month=...&year=...
GET /api/attendance/yearly?companyId=...&year=...
GET /api/attendance/analytics?companyId=...&from=...&to=...
```

### Admin
```javascript
POST /api/admin/assign-device
```

---

## 🚨 Critical Changes for Frontend

### 1. Heartbeat Interval Changed
- **Old**: 30 minutes
- **New**: 5 minutes
- **Action**: Update `REACT_APP_HEARTBEAT_INTERVAL=300000`

### 2. Session Expiry Enforcement
- Heartbeat endpoint now validates session age
- If session > 8 hours, returns 401 Unauthorized
- **Action**: Handle 401 errors by logging out user

### 3. Verify Session Enhanced
- Now includes `timeSinceLastHeartbeatMs`
- **Action**: Use this to calculate accurate next heartbeat timing

---

## 🔄 Recommended Heartbeat Logic

```javascript
// In your React app
const HEARTBEAT_INTERVAL = 300000; // 5 minutes
let heartbeatTimeout;

async function setupHeartbeat(sessionId) {
  try {
    // Verify session and get timing info
    const response = await verifySession(sessionId);
    
    if (!response.valid) {
      // Session invalid - logout
      handleLogout();
      return;
    }
    
    // Calculate when to send next heartbeat
    const timeSinceLastHeartbeat = response.session.timeSinceLastHeartbeatMs || 0;
    const nextHeartbeatDelay = Math.max(
      0, 
      HEARTBEAT_INTERVAL - timeSinceLastHeartbeat
    );
    
    // Schedule next heartbeat
    clearTimeout(heartbeatTimeout);
    heartbeatTimeout = setTimeout(async () => {
      await sendHeartbeat(sessionId);
      setupHeartbeat(sessionId); // Recursive call
    }, nextHeartbeatDelay);
    
  } catch (error) {
    if (error.status === 401) {
      // Session expired or invalid
      handleLogout();
    } else {
      // Network error - retry after 1 minute
      clearTimeout(heartbeatTimeout);
      heartbeatTimeout = setTimeout(() => {
        setupHeartbeat(sessionId);
      }, 60000);
    }
  }
}

async function sendHeartbeat(sessionId) {
  try {
    await fetch(`${API_BASE_URL}/api/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        deviceId: getDeviceId()
      })
    });
  } catch (error) {
    console.error('Heartbeat failed:', error);
    throw error;
  }
}

function handleLogout() {
  // Clear session
  localStorage.removeItem('sessionId');
  // Redirect to login
  window.location.href = '/login';
}
```

---

## 🧪 Testing Checklist

Before deploying frontend:

### Employee App:
- [ ] Login with valid credentials
- [ ] Login fails outside location (if allocated)
- [ ] Heartbeat sends every 5 minutes
- [ ] Session persists after app close/reopen
- [ ] Session expires after 8 hours
- [ ] Logout works correctly
- [ ] Location tracking is accurate

### Admin Dashboard:
- [ ] Admin login works (any location, any device)
- [ ] View all employees
- [ ] Create/edit/delete users
- [ ] Assign devices to users
- [ ] View sessions with pagination
- [ ] Export attendance CSV
- [ ] View daily/monthly/yearly reports
- [ ] User work report loads correctly
- [ ] Create/delete locations

---

## 📞 Troubleshooting

### CORS Errors
**Symptom**: Browser console shows CORS policy errors

**Fix**:
1. Ensure backend `CORS_ORIGINS` includes your frontend URL
2. Redeploy backend after updating CORS_ORIGINS
3. Clear browser cache

### 401 Unauthorized on Heartbeat
**Symptom**: User logged out unexpectedly

**Causes**:
- Session expired (> 8 hours)
- Invalid sessionId
- Device mismatch

**Fix**:
- Verify session before sending heartbeat
- Store sessionId securely
- Handle 401 by redirecting to login

### Heartbeat Timing Issues
**Symptom**: Multiple heartbeats or missed heartbeats

**Fix**:
- Use `timeSinceLastHeartbeatMs` from verify-session
- Clear previous timeout before setting new one
- Handle app pause/resume events

---

## 🎉 Ready for Production!

Once you:
1. Deploy backend to Vercel
2. Get production URL
3. Update frontend `.env.production`
4. Test all APIs
5. Deploy frontend

You're good to go! 🚀
