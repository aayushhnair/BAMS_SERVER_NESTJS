# 📚 Complete API Documentation - BAS Backend

## Base URL
- **Development**: `http://localhost:4000`
- **Production**: `https://bamsserver.vercel.app`

---

## 🔐 Authentication APIs

### 1. Login
**Endpoint**: `POST /api/auth/login`

**Request Payload**:
```json
{
  "username": "aayushhnair",
  "password": "Ayush@123",
  "deviceId": "DEVICE-MGUH36NP-WEOOIV",
  "location": {
    "lat": 12.9716,
    "lon": 77.5946,
    "accuracy": 10
  }
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "sessionId": "67116f8a4c58d95a780570d5",
  "expiresIn": 28800
}
```

**Error Responses**:
```json
// Invalid credentials
{
  "statusCode": 401,
  "message": "Invalid credentials"
}

// Device not assigned (for employees)
{
  "ok": false,
  "error": "NOT_ASSIGNED"
}

// Location not allowed (for employees)
{
  "ok": false,
  "error": "LOCATION_NOT_ALLOWED"
}

// Not within allocated location
{
  "ok": false,
  "error": "NOT_WITHIN_ALLOCATED_LOCATION"
}
```

---

### 2. Verify Session
**Endpoint**: `POST /api/auth/verify-session`

**Request Payload**:
```json
{
  "sessionId": "67116f8a4c58d95a780570d5"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "valid": true,
  "session": {
    "sessionId": "67116f8a4c58d95a780570d5",
    "userId": "68f1e1d94c58d95a780570cc",
    "deviceId": "DEVICE-MGUH36NP-WEOOIV",
    "loginAt": "2025-10-17T09:00:00.000Z",
    "lastHeartbeat": "2025-10-17T09:30:00.000Z",
    "timeSinceLastHeartbeatMs": 15000,
    "status": "active"
  },
  "user": {
    "_id": "68f1e1d94c58d95a780570cc",
    "username": "aayushhnair",
    "displayName": "Ayush V Nair",
    "role": "employee",
    "companyId": "68f1e20b4c58d95a780570d0"
  },
  "expiresIn": 27300
}
```

**Error Response** (Session expired):
```json
{
  "ok": false,
  "valid": false,
  "error": "Session expired",
  "expiredAt": "2025-10-17T17:00:00.000Z"
}
```

---

### 3. Logout
**Endpoint**: `POST /api/auth/logout`

**Request Payload**:
```json
{
  "sessionId": "67116f8a4c58d95a780570d5",
  "deviceId": "DEVICE-MGUH36NP-WEOOIV"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

---

### 4. Heartbeat
**Endpoint**: `POST /api/heartbeat`

**Request Payload**:
```json
{
  "sessionId": "67116f8a4c58d95a780570d5",
  "deviceId": "DEVICE-MGUH36NP-WEOOIV"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "message": "Heartbeat updated"
}
```

**Error Response** (Session expired):
```json
{
  "statusCode": 401,
  "message": "Session expired"
}
```

---

## 👥 User Management APIs

### 5. Create Admin User
**Endpoint**: `POST /api/users/create-admin`

**Request Payload**:
```json
{
  "username": "admin@company.com",
  "password": "SecurePassword123!",
  "displayName": "System Administrator"
}
```

**Success Response** (201):
```json
{
  "ok": true,
  "user": {
    "_id": "68f1e1d94c58d95a780570cd",
    "username": "admin@company.com",
    "displayName": "System Administrator",
    "role": "admin",
    "assignedDeviceId": "admin-device-1729166400000-abc123xyz"
  },
  "deviceId": "admin-device-1729166400000-abc123xyz",
  "message": "Standalone admin user created successfully with auto-assigned device"
}
```

---

### 6. Create Employee User
**Endpoint**: `POST /api/users`

**Request Payload**:
```json
{
  "companyId": "68f1e20b4c58d95a780570d0",
  "username": "employee@company.com",
  "password": "SecurePassword123!",
  "displayName": "John Doe",
  "assignedDeviceId": "DEVICE-MGUH36NP-WEOOIV",
  "allocatedLocationId": "68f1e2504c58d95a780570d2",
  "role": "employee"
}
```

**Success Response** (201):
```json
{
  "ok": true,
  "user": {
    "_id": "68f1e1d94c58d95a780570ce",
    "companyId": "68f1e20b4c58d95a780570d0",
    "username": "employee@company.com",
    "displayName": "John Doe",
    "assignedDeviceId": "DEVICE-MGUH36NP-WEOOIV",
    "allocatedLocationId": "68f1e2504c58d95a780570d2",
    "role": "employee"
  },
  "message": "Employee user created successfully"
}
```

**Error Responses**:
```json
// Username already exists
{
  "statusCode": 409,
  "message": "Username already exists"
}

// Device already assigned
{
  "statusCode": 409,
  "message": "Device DEVICE-XXX is already assigned to user username"
}

// Password too weak
{
  "statusCode": 400,
  "message": "Password requirements not met: Password must be at least 8 characters"
}
```

---

### 7. Get All Users
**Endpoint**: `GET /api/users?companyId=xxx&role=employee`

**Query Parameters** (all optional):
- `companyId`: Filter by company ID
- `role`: Filter by role (employee/admin)

**Success Response** (200):
```json
{
  "ok": true,
  "users": [
    {
      "_id": "68f1e1d94c58d95a780570cc",
      "username": "aayushhnair",
      "displayName": "Ayush V Nair",
      "role": "employee",
      "companyId": "68f1e20b4c58d95a780570d0",
      "assignedDeviceId": "DEVICE-MGUH36NP-WEOOIV",
      "allocatedLocationId": "68f1e2504c58d95a780570d2"
    }
  ]
}
```

---

### 8. Get User by ID
**Endpoint**: `GET /api/users/:id`

**Success Response** (200):
```json
{
  "ok": true,
  "user": {
    "_id": "68f1e1d94c58d95a780570cc",
    "username": "aayushhnair",
    "displayName": "Ayush V Nair",
    "role": "employee",
    "companyId": "68f1e20b4c58d95a780570d0",
    "assignedDeviceId": "DEVICE-MGUH36NP-WEOOIV",
    "allocatedLocationId": "68f1e2504c58d95a780570d2"
  }
}
```

---

### 9. Update User
**Endpoint**: `PUT /api/users/:id`

**Request Payload** (all fields optional):
```json
{
  "displayName": "Updated Name",
  "password": "NewPassword123!",
  "assignedDeviceId": "NEW-DEVICE-ID",
  "allocatedLocationId": "NEW-LOCATION-ID"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "user": {
    "_id": "68f1e1d94c58d95a780570cc",
    "username": "aayushhnair",
    "displayName": "Updated Name",
    "role": "employee",
    "companyId": "68f1e20b4c58d95a780570d0",
    "assignedDeviceId": "NEW-DEVICE-ID",
    "allocatedLocationId": "NEW-LOCATION-ID"
  },
  "message": "User updated successfully"
}
```

---

### 10. Delete User
**Endpoint**: `DELETE /api/users/:id`

**Success Response** (200):
```json
{
  "ok": true,
  "message": "User deleted successfully"
}
```

---

### 11. Get Available Devices for Company
**Endpoint**: `GET /api/users/available-devices/:companyId`

**Success Response** (200):
```json
{
  "ok": true,
  "devices": [
    {
      "_id": "68f1e2304c58d95a780570d1",
      "deviceId": "DEVICE-ABC123",
      "serial": "SN-001",
      "name": "Device 1",
      "companyId": "68f1e20b4c58d95a780570d0",
      "lastSeen": "2025-10-17T10:00:00.000Z"
    }
  ]
}
```

---

## 📱 Device Management APIs

### 12. Register Device
**Endpoint**: `POST /api/device/register`

**Request Payload**:
```json
{
  "deviceId": "DEVICE-MGUH36NP-WEOOIV",
  "serial": "SN-12345678",
  "name": "Employee Tablet 1",
  "companyId": "68f1e20b4c58d95a780570d0"
}
```

**Success Response** (201):
```json
{
  "ok": true,
  "deviceId": "DEVICE-MGUH36NP-WEOOIV",
  "companyName": "Bhisshma Solutions",
  "message": "Device registered successfully"
}
```

**Error Responses**:
```json
// Device already registered
{
  "statusCode": 409,
  "message": "Device already registered"
}

// Company not found
{
  "statusCode": 400,
  "message": "Company not found"
}
```

---

### 13. Get All Devices
**Endpoint**: `GET /api/device?companyId=xxx`

**Query Parameters** (optional):
- `companyId`: Filter by company ID (if not provided, returns all devices)

**Success Response** (200):
```json
{
  "ok": true,
  "devices": [
    {
      "id": "68f1e2304c58d95a780570d1",
      "deviceId": "DEVICE-MGUH36NP-WEOOIV",
      "serial": "SN-12345678",
      "name": "Employee Tablet 1",
      "companyId": "68f1e20b4c58d95a780570d0",
      "companyName": "Bhisshma Solutions",
      "assignedTo": "68f1e1d94c58d95a780570cc",
      "lastSeen": "2025-10-17T10:00:00.000Z"
    }
  ]
}
```

---

### 14. Delete Device
**Endpoint**: `DELETE /api/device/:id`

**Success Response** (200):
```json
{
  "ok": true,
  "message": "Device deleted successfully"
}
```

---

## 🏢 Company Management APIs

### 15. Create Company
**Endpoint**: `POST /api/companies`

**Request Payload**:
```json
{
  "name": "Bhisshma Solutions",
  "address": "123 Business Street, Bangalore",
  "contactEmail": "contact@bhisshma.com",
  "contactPhone": "+91-9876543210"
}
```

**Success Response** (201):
```json
{
  "ok": true,
  "company": {
    "_id": "68f1e20b4c58d95a780570d0",
    "name": "Bhisshma Solutions",
    "address": "123 Business Street, Bangalore",
    "contactEmail": "contact@bhisshma.com",
    "contactPhone": "+91-9876543210"
  },
  "message": "Company created successfully"
}
```

---

### 16. Get All Companies
**Endpoint**: `GET /api/companies`

**Success Response** (200):
```json
{
  "ok": true,
  "companies": [
    {
      "_id": "68f1e20b4c58d95a780570d0",
      "name": "Bhisshma Solutions",
      "address": "123 Business Street, Bangalore",
      "contactEmail": "contact@bhisshma.com",
      "contactPhone": "+91-9876543210"
    }
  ]
}
```

---

### 17. Get Company by ID
**Endpoint**: `GET /api/companies/:id`

**Success Response** (200):
```json
{
  "ok": true,
  "company": {
    "_id": "68f1e20b4c58d95a780570d0",
    "name": "Bhisshma Solutions",
    "address": "123 Business Street, Bangalore",
    "contactEmail": "contact@bhisshma.com",
    "contactPhone": "+91-9876543210"
  }
}
```

---

### 18. Update Company
**Endpoint**: `PUT /api/companies/:id`

**Request Payload** (all fields optional):
```json
{
  "name": "Updated Company Name",
  "address": "New Address",
  "contactEmail": "new@email.com",
  "contactPhone": "+91-1234567890"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "company": {
    "_id": "68f1e20b4c58d95a780570d0",
    "name": "Updated Company Name",
    "address": "New Address",
    "contactEmail": "new@email.com",
    "contactPhone": "+91-1234567890"
  },
  "message": "Company updated successfully"
}
```

---

## 📍 Location Management APIs

### 19. Create Location
**Endpoint**: `POST /api/locations`

**Request Payload**:
```json
{
  "companyId": "68f1e20b4c58d95a780570d0",
  "name": "Head Office",
  "lat": 12.9716,
  "lon": 77.5946,
  "radiusMeters": 100
}
```

**Success Response** (201):
```json
{
  "ok": true,
  "locationId": "68f1e2504c58d95a780570d2",
  "message": "Location created successfully"
}
```

---

### 20. Get All Locations
**Endpoint**: `GET /api/locations?companyId=xxx`

**Query Parameters** (optional):
- `companyId`: Filter by company ID

**Success Response** (200):
```json
{
  "ok": true,
  "locations": [
    {
      "id": "68f1e2504c58d95a780570d2",
      "companyId": "68f1e20b4c58d95a780570d0",
      "name": "Head Office",
      "lat": 12.9716,
      "lon": 77.5946,
      "radiusMeters": 100
    }
  ]
}
```

---

### 21. Delete Location
**Endpoint**: `POST /api/locations/delete`

**Request Payload**:
```json
{
  "id": "68f1e2504c58d95a780570d2"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "message": "Location deleted successfully",
  "id": "68f1e2504c58d95a780570d2"
}
```

---

## 📊 Session & Attendance APIs

### 22. Get Sessions (Paginated)
**Endpoint**: `GET /api/sessions?companyId=xxx&userId=xxx&from=xxx&to=xxx&skip=0&limit=50`

**Query Parameters** (all optional):
- `companyId`: Filter by company
- `userId`: Filter by user
- `from`: Start date (ISO format)
- `to`: End date (ISO format)
- `skip`: Number of records to skip (default: 0)
- `limit`: Number of records to return (default: 100, max: 1000)

**Success Response** (200):
```json
{
  "ok": true,
  "total": 150,
  "skip": 0,
  "limit": 50,
  "count": 50,
  "sessions": [
    {
      "sessionId": "67116f8a4c58d95a780570d5",
      "companyId": "68f1e20b4c58d95a780570d0",
      "userId": "68f1e1d94c58d95a780570cc",
      "username": "aayushhnair",
      "userDisplayName": "Ayush V Nair",
      "deviceId": "DEVICE-MGUH36NP-WEOOIV",
      "loginAt": "2025-10-17T09:00:00.000Z",
      "logoutAt": "2025-10-17T17:30:00.000Z",
      "workingHours": 8.5,
      "workingMinutes": 510,
      "status": "logged_out",
      "lastHeartbeat": "2025-10-17T17:25:00.000Z",
      "loginLocation": {
        "lat": 12.9716,
        "lon": 77.5946,
        "accuracy": 10
      },
      "logoutLocation": {
        "lat": 12.9716,
        "lon": 77.5946,
        "accuracy": 10
      }
    }
  ]
}
```

---

### 23. Export Sessions (CSV)
**Endpoint**: `GET /api/export?companyId=xxx&from=xxx&to=xxx&format=csv`

**Query Parameters**:
- `companyId` (optional): Filter by company
- `from` (optional): Start date
- `to` (optional): End date
- `format` (optional): `csv` or `json` (default: csv)

**Success Response** (200):
Downloads CSV file with all sessions

---

### 24. User Work Report (JSON)
**Endpoint**: `GET /api/user-work-report?userId=xxx&type=monthly&date=2025-10-01`

**Query Parameters**:
- `userId` (required): User's MongoDB ObjectId
- `type` (required): `daily`, `weekly`, `monthly`, `yearly`
- `date` (optional): ISO date string (defaults to today)

**Success Response** (200):
```json
{
  "ok": true,
  "user": {
    "userId": "68f1e1d94c58d95a780570cc",
    "username": "aayushhnair",
    "displayName": "Ayush V Nair"
  },
  "type": "monthly",
  "from": "2025-10-01T00:00:00.000Z",
  "to": "2025-11-01T00:00:00.000Z",
  "totalSessions": 22,
  "totalWorkingMinutes": 10560,
  "totalWorkingHours": 176,
  "sessions": [
    {
      "sessionId": "67116f8a4c58d95a780570d5",
      "loginAt": "2025-10-01T09:00:00.000Z",
      "logoutAt": "2025-10-01T17:30:00.000Z",
      "workingMinutes": 510,
      "status": "logged_out"
    }
  ]
}
```

---

### 25. Export User Work Report (CSV) - NEW! ⭐
**Endpoint**: `GET /api/user-work-report/export?userId=xxx&type=monthly&date=2025-10-01`

**Query Parameters**:
- `userId` (required): User's MongoDB ObjectId
- `type` (required): `daily`, `weekly`, `monthly`, `yearly`
- `date` (optional): ISO date string (defaults to today)

**Success Response** (200):
Downloads CSV file with format:
```csv
User,Username,Report Type,Period From,Period To,Session ID,Login Time,Logout Time,Working Minutes,Working Hours,Status
"Ayush V Nair","aayushhnair","MONTHLY","2025-10-01","2025-11-01","671..","2025-10-01T09:00:00.000Z","2025-10-01T17:30:00.000Z",510,8.5,"logged_out"
"TOTAL","aayushhnair","MONTHLY","2025-10-01","2025-11-01","22 sessions","","",10560,176,""
```

**Filename**: `user_work_report_{username}_{type}_{date}.csv`

---

### 26. Daily Attendance Report
**Endpoint**: `GET /api/attendance/daily?companyId=xxx&date=2025-10-17`

**Query Parameters**:
- `companyId` (required): Company ID
- `date` (optional): ISO date (defaults to today)

**Success Response** (200):
```json
{
  "ok": true,
  "companyId": "68f1e20b4c58d95a780570d0",
  "date": "2025-10-17",
  "totalEmployees": 10,
  "presentCount": 8,
  "absentCount": 2,
  "attendance": [
    {
      "userId": "68f1e1d94c58d95a780570cc",
      "username": "aayushhnair",
      "displayName": "Ayush V Nair",
      "status": "present",
      "loginTime": "2025-10-17T09:00:00.000Z",
      "logoutTime": "2025-10-17T17:30:00.000Z",
      "workingHours": 8.5
    }
  ]
}
```

---

### 27. Monthly Attendance Report
**Endpoint**: `GET /api/attendance/monthly?companyId=xxx&month=10&year=2025`

**Query Parameters**:
- `companyId` (required): Company ID
- `month` (optional): Month number 1-12 (defaults to current)
- `year` (optional): Year (defaults to current)

**Success Response** (200):
```json
{
  "ok": true,
  "companyId": "68f1e20b4c58d95a780570d0",
  "month": 10,
  "year": 2025,
  "totalWorkingDays": 22,
  "employees": [
    {
      "userId": "68f1e1d94c58d95a780570cc",
      "username": "aayushhnair",
      "displayName": "Ayush V Nair",
      "presentDays": 20,
      "absentDays": 2,
      "totalWorkingHours": 160,
      "averageHoursPerDay": 8
    }
  ]
}
```

---

### 28. Yearly Attendance Report
**Endpoint**: `GET /api/attendance/yearly?companyId=xxx&year=2025`

**Query Parameters**:
- `companyId` (required): Company ID
- `year` (optional): Year (defaults to current)

**Success Response** (200):
```json
{
  "ok": true,
  "companyId": "68f1e20b4c58d95a780570d0",
  "year": 2025,
  "totalWorkingDays": 250,
  "employees": [
    {
      "userId": "68f1e1d94c58d95a780570cc",
      "username": "aayushhnair",
      "displayName": "Ayush V Nair",
      "presentDays": 230,
      "absentDays": 20,
      "totalWorkingHours": 1840,
      "averageHoursPerDay": 8
    }
  ]
}
```

---

### 29. Attendance Analytics
**Endpoint**: `GET /api/attendance/analytics?companyId=xxx&from=2025-10-01&to=2025-10-31`

**Query Parameters**:
- `companyId` (required): Company ID
- `from` (optional): Start date
- `to` (optional): End date

**Success Response** (200):
```json
{
  "ok": true,
  "companyId": "68f1e20b4c58d95a780570d0",
  "period": {
    "from": "2025-10-01T00:00:00.000Z",
    "to": "2025-10-31T23:59:59.999Z"
  },
  "summary": {
    "totalEmployees": 10,
    "averageAttendance": 85,
    "totalWorkingHours": 1760,
    "averageHoursPerEmployee": 176
  },
  "employees": [
    {
      "userId": "68f1e1d94c58d95a780570cc",
      "displayName": "Ayush V Nair",
      "attendanceRate": 90,
      "totalHours": 176,
      "averageHoursPerDay": 8
    }
  ]
}
```

---

## 🔧 Admin APIs

### 30. Assign Device to User
**Endpoint**: `POST /api/admin/assign-device`

**Request Payload**:
```json
{
  "userId": "68f1e1d94c58d95a780570cc",
  "deviceId": "DEVICE-MGUH36NP-WEOOIV"
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "message": "Device assigned successfully",
  "deviceId": "DEVICE-MGUH36NP-WEOOIV",
  "userId": "68f1e1d94c58d95a780570cc",
  "companyId": "68f1e20b4c58d95a780570d0"
}
```

---

## 📝 Notes

### Authentication
- Admins can login from **any device** and **any location**
- Employees must use their **assigned device** and be within **allocated location** (or general company location)
- Sessions expire after **8 hours** (configurable)
- Heartbeat required every **5 minutes** (configurable)

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Date Formats
- All dates in **ISO 8601 format**: `2025-10-17T09:00:00.000Z`
- Date-only queries: `2025-10-17`

### Pagination
- Default limit: 100 records
- Maximum limit: 1000 records
- Use `skip` and `limit` for pagination

### Error Handling
All errors follow this format:
```json
{
  "statusCode": 400,
  "message": "Error message here"
}
```

Common HTTP status codes:
- **200**: Success
- **201**: Created
- **400**: Bad Request
- **401**: Unauthorized
- **403**: Forbidden
- **404**: Not Found
- **409**: Conflict
- **500**: Internal Server Error

---

**Last Updated**: October 17, 2025
**Version**: 1.0
**Base URL**: `https://bamsserver.vercel.app`
