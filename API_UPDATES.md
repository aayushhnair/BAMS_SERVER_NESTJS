# 🔧 API Updates Summary

## Changes Made

### 1. ✅ Fixed Device API - Returns All Devices
**Endpoint:** `GET /api/device`

**Before:** Would error if companyId not provided
**After:** Returns all devices when no companyId query parameter

**Usage:**
```bash
# Get all devices
GET http://localhost:4000/api/device

# Get devices for specific company
GET http://localhost:4000/api/device?companyId=68f1e20b4c58d95a780570d0
```

**Response:**
```json
{
  "ok": true,
  "devices": [
    {
      "id": "...",
      "deviceId": "DEVICE-MGUH36NP-WEOOIV",
      "serial": "SN12345",
      "name": "Device Name",
      "companyId": "68f1e20b4c58d95a780570d0",
      "companyName": "Company Name",
      "assignedTo": "userId or null",
      "lastSeen": "2025-10-17T..."
    }
  ]
}
```

---

### 2. ✅ User Update/Edit API (Already Exists)
**Endpoint:** `PUT /api/users/:id`

**Usage:**
```bash
PUT http://localhost:4000/api/users/68f1e1d94c58d95a780570cc
Content-Type: application/json

{
  "displayName": "Updated Name",
  "password": "NewPassword123!",
  "assignedDeviceId": "new-device-id",
  "allocatedLocationId": "new-location-id"
}
```

**Response:**
```json
{
  "ok": true,
  "user": {
    "_id": "68f1e1d94c58d95a780570cc",
    "username": "aayushhnair",
    "displayName": "Updated Name",
    "role": "employee",
    "assignedDeviceId": "new-device-id",
    "allocatedLocationId": "new-location-id",
    "companyId": "..."
  },
  "message": "User updated successfully"
}
```

**Notes:**
- Password is optional (will be hashed if provided)
- Can update: displayName, password, assignedDeviceId, allocatedLocationId
- Device and location validation included
- Cannot change username or role

---

### 3. ✅ NEW: User Work Report CSV Export
**Endpoint:** `GET /api/user-work-report/export`

**Query Parameters:**
- `userId` (required): User's MongoDB ObjectId
- `type` (required): `daily`, `weekly`, `monthly`, or `yearly`
- `date` (optional): ISO date string (defaults to today)

**Usage Examples:**

```bash
# Daily report for user
GET http://localhost:4000/api/user-work-report/export?userId=68f1e1d94c58d95a780570cc&type=daily

# Weekly report
GET http://localhost:4000/api/user-work-report/export?userId=68f1e1d94c58d95a780570cc&type=weekly

# Monthly report for specific date
GET http://localhost:4000/api/user-work-report/export?userId=68f1e1d94c58d95a780570cc&type=monthly&date=2025-10-01

# Yearly report
GET http://localhost:4000/api/user-work-report/export?userId=68f1e1d94c58d95a780570cc&type=yearly&date=2025-01-01
```

**Response:**
- Downloads as CSV file
- Filename: `user_work_report_{username}_{type}_{date}.csv`
- Example: `user_work_report_aayushhnair_monthly_2025-10-17.csv`

**CSV Format:**
```csv
User,Username,Report Type,Period From,Period To,Session ID,Login Time,Logout Time,Working Minutes,Working Hours,Status
"Ayush V Nair","aayushhnair","DAILY","2025-10-17","2025-10-18","671..","2025-10-17T09:00:00.000Z","2025-10-17T17:30:00.000Z",510,8.5,"logged_out"
"Ayush V Nair","aayushhnair","DAILY","2025-10-17","2025-10-18","672..","2025-10-17T18:00:00.000Z","2025-10-17T20:00:00.000Z",120,2,"logged_out"
"TOTAL","aayushhnair","DAILY","2025-10-17","2025-10-18","2 sessions","","",630,10.5,""
```

**CSV Columns:**
1. User - Display name
2. Username - Login username
3. Report Type - DAILY/WEEKLY/MONTHLY/YEARLY
4. Period From - Start date of report period
5. Period To - End date of report period
6. Session ID - Unique session identifier
7. Login Time - ISO timestamp
8. Logout Time - ISO timestamp
9. Working Minutes - Duration in minutes
10. Working Hours - Duration in hours (2 decimals)
11. Status - Session status (active/logged_out/expired)

**Summary Row:**
- Last row shows totals
- Total sessions count
- Total working minutes
- Total working hours

---

## Frontend Integration

### Fix Device Service Port Issue

Your frontend is calling `http://localhost:3500` but backend is on `4000`.

**Update deviceService.ts:**
```javascript
const API_BASE_URL = 'http://localhost:4000'; // Change from 3500 to 4000
```

### User Update Example (React)
```javascript
async function updateUser(userId, updates) {
  const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  return response.json();
}

// Usage
await updateUser('68f1e1d94c58d95a780570cc', {
  displayName: 'New Name',
  assignedDeviceId: 'new-device-id'
});
```

### CSV Export Example (React)
```javascript
async function exportUserWorkReport(userId, type, date) {
  const url = `${API_BASE_URL}/api/user-work-report/export?userId=${userId}&type=${type}${date ? `&date=${date}` : ''}`;
  
  // Download CSV
  window.open(url, '_blank');
  
  // Or fetch and process
  const response = await fetch(url);
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `user_report_${type}.csv`;
  link.click();
}

// Usage
await exportUserWorkReport('68f1e1d94c58d95a780570cc', 'monthly', '2025-10-01');
```

---

## Testing

### Test Device API
```bash
# Get all devices
curl http://localhost:4000/api/device

# Should return all devices including admin virtual devices
```

### Test User Update
```bash
curl -X PUT http://localhost:4000/api/users/68f1e1d94c58d95a780570cc \
  -H "Content-Type: application/json" \
  -d '{"displayName":"Updated Name"}'
```

### Test CSV Export
```bash
curl "http://localhost:4000/api/user-work-report/export?userId=68f1e1d94c58d95a780570cc&type=monthly" \
  --output report.csv
```

---

## Summary

✅ **Device API**: Now returns all devices when no companyId provided
✅ **User Update API**: Already exists at `PUT /api/users/:id`
✅ **CSV Export**: New endpoint for user work reports with daily/weekly/monthly/yearly options

**All changes are backward compatible and production-ready!**
