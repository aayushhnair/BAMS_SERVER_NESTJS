# BAMS Admin Dashboard - Complete API Reference

## 🔐 Authentication APIs

### 1. Admin Login
**Method:** `POST`  
**URL:** `/api/auth/login`  
**Payload:**
```json
{
  "username": "admin@company.com",
  "password": "Admin123@",
  "deviceId": "ADMIN-LAPTOP-ABC123",
  "location": {
    "lat": 12.971599,
    "lon": 77.594566,
    "accuracy": 10
  }
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "sessionId": "68ef6fb870a878aac6cfd521",
  "expiresIn": 43200
}
```
**Error Responses:**
```json
// Invalid Credentials (401)
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

---

### 2. Verify Session
**Method:** `POST`  
**URL:** `/api/auth/verify-session`  
**Payload:**
```json
{
  "sessionId": "68ef6fb870a878aac6cfd521"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "valid": true,
  "session": {
    "sessionId": "68ef6fb870a878aac6cfd521",
    "userId": "user_id_here",
    "deviceId": "ADMIN-LAPTOP-ABC123",
    "loginAt": "2025-10-15T09:30:00.000Z",
    "lastHeartbeat": "2025-10-15T10:00:00.000Z",
    "status": "active"
  },
  "user": {
    "_id": "user_id_here",
    "username": "admin@company.com",
    "displayName": "Admin Name",
    "role": "admin",
    "companyId": "company_id_here"
  },
  "expiresIn": 41400
}
```
**Invalid Session Response (200):**
```json
{
  "ok": false,
  "valid": false,
  "error": "Session not found"
}
```

---

### 3. Heartbeat
**Method:** `POST`  
**URL:** `/api/heartbeat`  
**Payload:**
```json
{
  "sessionId": "68ef6fb870a878aac6cfd521",
  "deviceId": "ADMIN-LAPTOP-ABC123",
  "location": {
    "lat": 12.971599,
    "lon": 77.594566,
    "accuracy": 5
  }
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "message": "Heartbeat updated"
}
```
**Error Response (401):**
```json
{
  "statusCode": 401,
  "message": "Session not found"
}
```

---

### 4. Logout
**Method:** `POST`  
**URL:** `/api/auth/logout`  
**Payload:**
```json
{
  "sessionId": "68ef6fb870a878aac6cfd521",
  "deviceId": "ADMIN-LAPTOP-ABC123",
  "location": {
    "lat": 12.971599,
    "lon": 77.594566,
    "accuracy": 5
  }
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "message": "Logged out successfully"
}
```

---

## 🏢 Company Management APIs

### 5. Create Company
**Method:** `POST`  
**URL:** `/api/companies`  
**Payload:**
```json
{
  "name": "Bhishma Solutions",
  "timezone": "Asia/Kolkata",
  "settings": {
    "sessionTimeoutHours": 12,
    "heartbeatMinutes": 30
  }
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "company": {
    "_id": "company_id_here",
    "name": "Bhishma Solutions",
    "timezone": "Asia/Kolkata",
    "settings": {
      "sessionTimeoutHours": 12,
      "heartbeatMinutes": 30
    },
    "createdAt": "2025-10-15T09:30:00.000Z"
  }
}
```

---

### 6. Get All Companies
**Method:** `GET`  
**URL:** `/api/companies`  
**Payload:** None  
**Success Response (200):**
```json
{
  "ok": true,
  "companies": [
    {
      "_id": "company_id_here",
      "name": "Bhishma Solutions",
      "timezone": "Asia/Kolkata",
      "settings": {
        "sessionTimeoutHours": 12,
        "heartbeatMinutes": 30
      },
      "createdAt": "2025-10-15T09:30:00.000Z"
    }
  ]
}
```

---

### 7. Get Company by ID
**Method:** `GET`  
**URL:** `/api/companies/:id`  
**Payload:** None  
**Success Response (200):**
```json
{
  "ok": true,
  "company": {
    "_id": "company_id_here",
    "name": "Bhishma Solutions",
    "timezone": "Asia/Kolkata",
    "settings": {
      "sessionTimeoutHours": 12,
      "heartbeatMinutes": 30
    },
    "createdAt": "2025-10-15T09:30:00.000Z"
  }
}
```

---

### 8. Update Company
**Method:** `PUT`  
**URL:** `/api/companies/:id`  
**Payload:**
```json
{
  "name": "Bhishma Solutions Pvt Ltd",
  "settings": {
    "sessionTimeoutHours": 10,
    "heartbeatMinutes": 20
  }
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "company": {
    "_id": "company_id_here",
    "name": "Bhishma Solutions Pvt Ltd",
    "timezone": "Asia/Kolkata",
    "settings": {
      "sessionTimeoutHours": 10,
      "heartbeatMinutes": 20
    }
  }
}
```

---

## 👥 User Management APIs

### 9. Create Admin User
**Method:** `POST`  
**URL:** `/api/users/create-admin`  
**Payload:**
```json
{
  "username": "admin@company.com",
  "password": "Admin123@",
  "displayName": "Admin Name",
  "role": "admin"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "user": {
    "_id": "user_id_here",
    "username": "admin@company.com",
    "displayName": "Admin Name",
    "role": "admin"
  },
  "message": "Standalone admin user created successfully"
}
```

---

### 10. Create Employee User
**Method:** `POST`  
**URL:** `/api/users`  
**Payload:**
```json
{
  "username": "employee@company.com",
  "password": "Employee123@",
  "displayName": "Employee Name",
  "role": "employee",
  "companyId": "company_id_here",
  "assignedDeviceId": "DEVICE-001",
  "allocatedLocationId": "location_id_here"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "user": {
    "_id": "user_id_here",
    "username": "employee@company.com",
    "displayName": "Employee Name",
    "role": "employee",
    "companyId": "company_id_here",
    "assignedDeviceId": "DEVICE-001",
    "allocatedLocationId": "location_id_here"
  },
  "message": "Employee user created successfully"
}
```

---

### 11. Get All Users
**Method:** `GET`  
**URL:** `/api/users?companyId={companyId}&role={role}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `role` (optional): Filter by role (admin/employee)

**Success Response (200):**
```json
{
  "ok": true,
  "users": [
    {
      "_id": "user_id_here",
      "username": "employee@company.com",
      "displayName": "Employee Name",
      "role": "employee",
      "companyId": "company_id_here",
      "assignedDeviceId": "DEVICE-001",
      "allocatedLocationId": "location_id_here"
    }
  ]
}
```

---

### 12. Get User by ID
**Method:** `GET`  
**URL:** `/api/users/:id`  
**Payload:** None  
**Success Response (200):**
```json
{
  "ok": true,
  "user": {
    "_id": "user_id_here",
    "username": "employee@company.com",
    "displayName": "Employee Name",
    "role": "employee",
    "companyId": "company_id_here",
    "assignedDeviceId": "DEVICE-001",
    "allocatedLocationId": "location_id_here"
  }
}
```

---

### 13. Update User
**Method:** `PUT`  
**URL:** `/api/users/:id`  
**Payload:**
```json
{
  "displayName": "Updated Name",
  "assignedDeviceId": "DEVICE-002",
  "allocatedLocationId": "new_location_id"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "user": {
    "_id": "user_id_here",
    "username": "employee@company.com",
    "displayName": "Updated Name",
    "role": "employee",
    "assignedDeviceId": "DEVICE-002",
    "allocatedLocationId": "new_location_id"
  },
  "message": "User updated successfully"
}
```

---

### 14. Delete User
**Method:** `DELETE`  
**URL:** `/api/users/:id`  
**Payload:** None  
**Success Response (200):**
```json
{
  "ok": true,
  "message": "User deleted successfully"
}
```

---

### 15. Get Available Devices for Company
**Method:** `GET`  
**URL:** `/api/users/available-devices/:companyId`  
**Payload:** None  
**Success Response (200):**
```json
{
  "ok": true,
  "devices": [
    {
      "_id": "device_id_here",
      "deviceId": "DEVICE-003",
      "deviceName": "Tablet 3",
      "companyId": "company_id_here",
      "lastSeen": "2025-10-15T10:00:00.000Z"
    }
  ]
}
```

---

## 📱 Device Management APIs

### 16. Register Device
**Method:** `POST`  
**URL:** `/api/device/register`  
**Payload:**
```json
{
  "deviceId": "DEVICE-001",
  "deviceName": "Employee Tablet 1",
  "companyId": "company_id_here"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "device": {
    "_id": "device_id_here",
    "deviceId": "DEVICE-001",
    "deviceName": "Employee Tablet 1",
    "companyId": "company_id_here",
    "registeredAt": "2025-10-15T09:30:00.000Z"
  },
  "message": "Device registered successfully"
}
```
**Error Response (409):**
```json
{
  "statusCode": 409,
  "message": "Device already registered"
}
```

---

### 17. Assign Device to User
**Method:** `POST`  
**URL:** `/api/admin/assign-device`  
**Payload:**
```json
{
  "userId": "user_id_here",
  "deviceId": "DEVICE-001"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "message": "Device assigned successfully"
}
```
**Error Responses:**
```json
// User not found (404)
{
  "statusCode": 404,
  "message": "User not found"
}

// Device not found (404)
{
  "statusCode": 404,
  "message": "Device not found"
}

// Device already assigned (400)
{
  "statusCode": 400,
  "message": "Device DEVICE-001 is already assigned to user employee@company.com"
}
```

---

## 📍 Location Management APIs

### 18. Create Location
**Method:** `POST`  
**URL:** `/api/locations`  
**Payload:**
```json
{
  "name": "Main Office",
  "lat": 12.971599,
  "lon": 77.594566,
  "radiusMeters": 100,
  "companyId": "company_id_here"
}
```
**Success Response (200):**
```json
{
  "ok": true,
  "location": {
    "_id": "location_id_here",
    "name": "Main Office",
    "coords": {
      "type": "Point",
      "coordinates": [77.594566, 12.971599]
    },
    "radiusMeters": 100,
    "companyId": "company_id_here",
    "createdAt": "2025-10-15T09:30:00.000Z"
  },
  "message": "Location created successfully"
}
```

---

### 19. Get All Locations
**Method:** `GET`  
**URL:** `/api/locations?companyId={companyId}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company

**Success Response (200):**
```json
{
  "ok": true,
  "locations": [
    {
      "_id": "location_id_here",
      "name": "Main Office",
      "coords": {
        "type": "Point",
        "coordinates": [77.594566, 12.971599]
      },
      "radiusMeters": 100,
      "companyId": "company_id_here",
      "createdAt": "2025-10-15T09:30:00.000Z"
    }
  ]
}
```

---

## 📊 Session Management APIs

### 20. Get All Sessions
**Method:** `GET`  
**URL:** `/api/sessions?companyId={companyId}&userId={userId}&status={status}&from={date}&to={date}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `userId` (optional): Filter by user
- `status` (optional): Filter by status (active/logged_out/expired/auto_logged_out)
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Success Response (200):**
```json
{
  "ok": true,
  "sessions": [
    {
      "_id": "session_id_here",
      "companyId": "company_id_here",
      "userId": "user_id_here",
      "deviceId": "DEVICE-001",
      "loginAt": "2025-10-15T09:00:00.000Z",
      "logoutAt": "2025-10-15T17:00:00.000Z",
      "status": "logged_out",
      "loginLocation": {
        "type": "Point",
        "coordinates": [77.594566, 12.971599],
        "accuracy": 10
      },
      "logoutLocation": {
        "type": "Point",
        "coordinates": [77.594566, 12.971599],
        "accuracy": 5
      },
      "lastHeartbeat": "2025-10-15T16:30:00.000Z"
    }
  ]
}
```

---

### 21. Export Sessions to CSV
**Method:** `GET`  
**URL:** `/api/export?companyId={companyId}&from={date}&to={date}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (required): Company ID
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Success Response (200):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="sessions-export-2025-10-15.csv"

User ID,Username,Display Name,Device ID,Login Time,Logout Time,Duration (hours),Status
user_id_1,employee1@company.com,Employee One,DEVICE-001,2025-10-15 09:00:00,2025-10-15 17:00:00,8.00,logged_out
```

---

## 📈 Attendance APIs

### 22. Get Daily Attendance
**Method:** `GET`  
**URL:** `/api/attendance/daily?companyId={companyId}&userId={userId}&from={date}&to={date}&format={format}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `userId` (optional): Filter by user ID
- `username` (optional): Filter by username
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `format` (optional): Response format (json/csv), default: json

**Success Response (200) - JSON:**
```json
{
  "ok": true,
  "attendance": [
    {
      "date": "2025-10-15",
      "userId": "user_id_here",
      "username": "employee@company.com",
      "userDisplayName": "Employee Name",
      "companyId": "company_id_here",
      "sessions": [
        {
          "sessionId": "session_id_here",
          "loginTime": "2025-10-15T09:00:00.000Z",
          "logoutTime": "2025-10-15T17:00:00.000Z",
          "duration": 8.0,
          "status": "logged_out"
        }
      ],
      "totalSessions": 1,
      "totalWorkingHours": 8.0,
      "totalWorkingMinutes": 480,
      "firstLoginTime": "2025-10-15T09:00:00.000Z",
      "lastLogoutTime": "2025-10-15T17:00:00.000Z",
      "isPresent": true,
      "breaks": [],
      "totalBreakTime": 0,
      "effectiveWorkingHours": 8.0
    }
  ]
}
```

**Success Response (200) - CSV:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="daily-attendance-2025-10-15.csv"

Date,User,Company,Sessions,Working Hours,First Login,Last Logout,Present,Break Time,Effective Hours
2025-10-15,Employee Name,Bhishma Solutions,1,8.00,09:00:00 AM IST,05:00:00 PM IST,Yes,0.00,8.00
```

---

### 23. Get Monthly Attendance
**Method:** `GET`  
**URL:** `/api/attendance/monthly?companyId={companyId}&userId={userId}&month={YYYY-MM}&format={format}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `userId` (optional): Filter by user ID
- `username` (optional): Filter by username
- `month` (optional): Month (YYYY-MM)
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)
- `format` (optional): Response format (json/csv), default: json

**Success Response (200) - JSON:**
```json
{
  "ok": true,
  "attendance": [
    {
      "month": "2025-10",
      "year": 2025,
      "monthName": "October",
      "userId": "user_id_here",
      "username": "employee@company.com",
      "userDisplayName": "Employee Name",
      "companyId": "company_id_here",
      "totalWorkingDays": 22,
      "presentDays": 20,
      "absentDays": 2,
      "attendancePercentage": 90.91,
      "totalWorkingHours": 160.0,
      "averageWorkingHoursPerDay": 8.0,
      "totalSessions": 20,
      "dailyRecords": [
        {
          "date": "2025-10-15",
          "totalWorkingHours": 8.0,
          "isPresent": true
        }
      ]
    }
  ]
}
```

**Success Response (200) - CSV:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="monthly-attendance-2025-10.csv"

Month,Year,User,Company,Working Days,Present Days,Absent Days,Attendance %,Total Hours,Avg Hours/Day
October,2025,Employee Name,Bhishma Solutions,22,20,2,90.91,160.00,8.00
```

---

### 24. Get Yearly Attendance
**Method:** `GET`  
**URL:** `/api/attendance/yearly?companyId={companyId}&userId={userId}&year={YYYY}&format={format}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `userId` (optional): Filter by user ID
- `username` (optional): Filter by username
- `year` (optional): Year (YYYY)
- `format` (optional): Response format (json/csv), default: json

**Success Response (200) - JSON:**
```json
{
  "ok": true,
  "attendance": [
    {
      "year": 2025,
      "userId": "user_id_here",
      "username": "employee@company.com",
      "userDisplayName": "Employee Name",
      "companyId": "company_id_here",
      "totalWorkingDays": 261,
      "presentDays": 240,
      "absentDays": 21,
      "attendancePercentage": 91.95,
      "totalWorkingHours": 1920.0,
      "averageWorkingHoursPerMonth": 160.0,
      "totalSessions": 240,
      "monthlyRecords": [
        {
          "month": "2025-10",
          "monthName": "October",
          "presentDays": 20,
          "totalWorkingHours": 160.0
        }
      ]
    }
  ]
}
```

**Success Response (200) - CSV:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="yearly-attendance-2025.csv"

Year,User,Company,Working Days,Present Days,Absent Days,Attendance %,Total Hours,Avg Hours/Month
2025,Employee Name,Bhishma Solutions,261,240,21,91.95,1920.00,160.00
```

---

### 25. Get Attendance Analytics
**Method:** `GET`  
**URL:** `/api/attendance/analytics?companyId={companyId}&from={date}&to={date}`  
**Payload:** None  
**Query Parameters:**
- `companyId` (optional): Filter by company
- `from` (optional): Start date (YYYY-MM-DD)
- `to` (optional): End date (YYYY-MM-DD)

**Success Response (200):**
```json
{
  "ok": true,
  "analytics": {
    "totalEmployees": 50,
    "presentToday": 45,
    "absentToday": 5,
    "averageWorkingHours": 7.8,
    "attendancePercentage": 90.0,
    "topPerformers": [
      {
        "userId": "user_id_here",
        "username": "employee@company.com",
        "displayName": "Employee Name",
        "attendancePercentage": 98.5,
        "totalWorkingHours": 180.0
      }
    ],
    "trends": {
      "dailyAverage": 45,
      "weeklyAverage": 47,
      "monthlyAverage": 46
    }
  }
}
```

---

## 📋 Quick Copy Format

### Authentication
```
POST /api/auth/login
POST /api/auth/verify-session
POST /api/heartbeat
POST /api/auth/logout
```

### Company Management
```
POST   /api/companies
GET    /api/companies
GET    /api/companies/:id
PUT    /api/companies/:id
```

### User Management
```
POST   /api/users/create-admin
POST   /api/users
GET    /api/users
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id
GET    /api/users/available-devices/:companyId
```

### Device Management
```
POST /api/device/register
POST /api/admin/assign-device
```

### Location Management
```
POST /api/locations
GET  /api/locations
```

### Session Management
```
GET /api/sessions
GET /api/export
```

### Attendance & Analytics
```
GET /api/attendance/daily
GET /api/attendance/monthly
GET /api/attendance/yearly
GET /api/attendance/analytics
```

---

## 🎯 Common Error Responses

**401 Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Invalid credentials"
}
```

**403 Forbidden:**
```json
{
  "statusCode": 403,
  "message": "Access denied"
}
```

**404 Not Found:**
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

**409 Conflict:**
```json
{
  "statusCode": 409,
  "message": "Resource already exists"
}
```

**500 Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## 📝 Notes

1. **IST Timezone:** All datetime fields in CSV exports are formatted in IST (Indian Standard Time)
2. **Company Names:** CSV exports include company names instead of just IDs
3. **Human-Readable Times:** Times are formatted as "HH:MM:SS AM/PM IST" in CSVs
4. **CSV Downloads:** Use `format=csv` query parameter for CSV downloads
5. **Filtering:** Most APIs support multiple filter combinations
6. **Pagination:** Not yet implemented (will return all results)
7. **Authentication:** Admin dashboard doesn't need location validation
8. **Session Timeout:** Default 12 hours, configurable per company

---

**API Base URL:** `http://localhost:4000` (Development)  
**Production URL:** Update in config before deployment
