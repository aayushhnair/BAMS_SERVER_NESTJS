# BAS System State Diagram & API Flow

## 🏗️ **System Setup Flow (No Authentication Required)**

```
┌─────────────────────────────────────────────────────────────────────┐
│                           INITIAL SYSTEM SETUP                     │
│                        (No Authentication Required)                │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 1: Create Company                                             │
│  POST /api/companies                                                │
│  Body: {                                                            │
│    "name": "Your Company Name",                                     │
│    "timezone": "Asia/Kolkata"                                       │
│  }                                                                  │
│  ✅ NO AUTH TOKEN REQUIRED                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 2: Register Device                                            │
│  POST /api/device/register                                          │
│  Body: {                                                            │
│    "deviceId": "unique_device_id",                                  │
│    "deviceName": "Office Tablet",                                   │
│    "companyId": "company_id_from_step1"                             │
│  }                                                                  │
│  ✅ NO AUTH TOKEN REQUIRED                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 3: Create First Admin User                                    │
│  POST /api/users/create-admin                                       │
│  Body: {                                                            │
│    "username": "admin@company.com",                                 │
│    "password": "AdminPass123!",                                     │
│    "displayName": "System Admin",                                   │
│    "companyId": "company_id_from_step1"                             │
│  }                                                                  │
│  ✅ NO AUTH TOKEN REQUIRED (First admin only)                      │
│  ✅ NO DEVICE/LOCATION REQUIRED                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 4: Admin Login                                                │
│  POST /api/auth/login                                               │
│  Body: {                                                            │
│    "username": "admin@company.com",                                 │
│    "password": "AdminPass123!",                                     │
│    "deviceId": "any_device_id",                                     │
│    "currentLocation": {                                             │
│      "lat": 0.0, "lon": 0.0, "accuracy": 1000                      │
│    }                                                                │
│  }                                                                  │
│  ✅ NO AUTH TOKEN REQUIRED                                          │
│  ✅ LOCATION VALIDATION SKIPPED FOR ADMIN                           │
│  ✅ DEVICE VALIDATION SKIPPED FOR ADMIN                             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 5: Create Location (Admin authenticated)                      │
│  POST /api/locations                                                │
│  Headers: Authorization: Bearer <admin_session_token>               │
│  Body: {                                                            │
│    "name": "Main Office",                                           │
│    "lat": 12.9716,                                                  │
│    "lon": 77.5946,                                                  │
│    "companyId": "company_id_from_step1"                             │
│  }                                                                  │
│  ❌ REQUIRES AUTHENTICATION                                         │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STEP 6: Create Employee Users (Admin authenticated)                │
│  POST /api/users                                                    │
│  Headers: Authorization: Bearer <admin_session_token>               │
│  Body: {                                                            │
│    "username": "employee@company.com",                              │
│    "password": "EmployeePass123!",                                  │
│    "displayName": "Employee Name",                                  │
│    "role": "employee",                                              │
│    "companyId": "company_id_from_step1",                            │
│    "allocatedLocationId": "location_id_from_step5",                 │
│    "assignedDeviceId": "device_id_from_step2"                       │
│  }                                                                  │
│  ❌ REQUIRES AUTHENTICATION                                         │
│  ⚠️  EMPLOYEES REQUIRE DEVICE & LOCATION                            │
└─────────────────────────────────────────────────────────────────────┘
```

## � **Admin vs Employee User Types**

### **🔑 Admin Users**
```
┌─────────────────────────────────────────────────────────────────────┐
│                           ADMIN USER PRIVILEGES                    │
└─────────────────────────────────────────────────────────────────────┘

Creation:
• POST /api/users/create-admin (No auth required for first admin)
• Only one admin per company initially
• No device assignment required
• No location allocation required

Login Behavior:
• ✅ Can login from ANY device
• ✅ Can login from ANY location (no proximity check)
• ✅ No location validation whatsoever
• ✅ Can use any deviceId in login request

Capabilities:
• 🏢 Manage company settings
• 👥 Create/manage all users (admin & employee)
• 📱 Register/manage devices
• 📍 Create/manage locations
• 📊 Access all attendance reports
• 🔧 System administration
```

### **👷 Employee Users**
```
┌─────────────────────────────────────────────────────────────────────┐
│                         EMPLOYEE USER RESTRICTIONS                 │
└─────────────────────────────────────────────────────────────────────┘

Creation:
• POST /api/users (Requires admin authentication)
• Must specify role: "employee"
• Should have assignedDeviceId (recommended)
• Should have allocatedLocationId (recommended)

Login Behavior:
• ❌ Must use assigned device only
• ❌ Must login from allocated location (100m proximity)
• ❌ Location validation strictly enforced
• ❌ Cannot login if device unassigned

Capabilities:
• �🔐 Login/logout for attendance tracking
• 💓 Send heartbeats to maintain session
• 👤 View own attendance records
• 🚫 Cannot manage other users
• 🚫 Cannot manage company settings
```

## 📋 **User Creation Examples**

### **Creating Admin User**
```bash
POST /api/users/create-admin
Content-Type: application/json
# No Authorization header needed

{
  "username": "admin@company.com",
  "password": "AdminSecure123!",
  "displayName": "System Administrator",
  "companyId": "company_id_here"
}

Response:
{
  "ok": true,
  "user": {
    "_id": "admin_user_id",
    "username": "admin@company.com",
    "displayName": "System Administrator",
    "role": "admin",
    "companyId": "company_id_here"
    // Note: No assignedDeviceId or allocatedLocationId
  },
  "message": "Admin user created successfully"
}
```

### **Creating Employee User**
```bash
POST /api/users
Content-Type: application/json
Authorization: Bearer <admin_session_token>

{
  "username": "john.doe@company.com",
  "password": "EmployeePass123!",
  "displayName": "John Doe",
  "role": "employee",
  "companyId": "company_id_here",
  "assignedDeviceId": "tablet_001",
  "allocatedLocationId": "main_office_location_id"
}

Response:
{
  "ok": true,
  "user": {
    "_id": "employee_user_id",
    "username": "john.doe@company.com",
    "displayName": "John Doe",
    "role": "employee",
    "companyId": "company_id_here",
    "assignedDeviceId": "tablet_001",
    "allocatedLocationId": "main_office_location_id"
  },
  "message": "Employee user created successfully"
}
```

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER AUTHENTICATION                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  User Login Attempt                                                 │
│  POST /api/auth/login                                               │
│  Body: {                                                            │
│    "username": "user@company.com",                                  │
│    "password": "userpassword",                                      │
│    "deviceId": "registered_device_id",                              │
│    "currentLocation": {                                             │
│      "lat": 12.9716,                                               │
│      "lon": 77.5946,                                               │
│      "accuracy": 10                                                 │
│    }                                                                │
│  }                                                                  │
│  ✅ NO AUTH TOKEN REQUIRED                                          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           VALIDATION CHECKS                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
        ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
        │  User Exists?   │ │ Password Valid? │ │ Device Valid?   │
        │                 │ │                 │ │                 │
        │ ✅ User found   │ │ ✅ bcrypt match │ │ ✅ Device reg.  │
        │ ❌ User not     │ │ ❌ Wrong pass   │ │ ❌ Device not   │
        │    found        │ │                 │ │    registered   │
        └─────────────────┘ └─────────────────┘ └─────────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCATION VALIDATION                          │
│                                                                     │
│  🎯 PROXIMITY CHECK: User must be within 100m of allocated location │
│                                                                     │
│  IF user.allocatedLocationId:                                       │
│    - Get allocated location coordinates                             │
│    - Calculate distance from current location                       │
│    - Distance <= 100m ? ✅ PASS : ❌ FAIL                          │
│                                                                     │
│  IF no allocated location:                                          │
│    - ✅ PASS (no location restriction)                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────────────┐   ┌─────────────────────────────┐
        │      ✅ LOGIN SUCCESS       │   │      ❌ LOGIN FAILED        │
        │                             │   │                             │
        │ • Create active session     │   │ • Return error message      │
        │ • Return session token      │   │ • No session created        │
        │ • Update device lastSeen    │   │                             │
        │ • Log login location        │   │                             │
        └─────────────────────────────┘   └─────────────────────────────┘
                    │
                    ▼
        ┌─────────────────────────────┐
        │     SESSION CREATED         │
        │                             │
        │ sessionId: "abc123..."      │
        │ status: "active"            │
        │ deviceId: "device_001"      │
        │ userId: "user_id"           │
        │ companyId: "company_id"     │
        │ loginAt: timestamp          │
        │ loginLocation: coordinates  │
        └─────────────────────────────┘
```

## 🔄 **Operational Flow (Authentication Required)**

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATED OPERATIONS                       │
│              (Requires: Authorization: Bearer <token>)             │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                ┌───────────────────┼───────────────────┐
                ▼                   ▼                   ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │  User Management│   │ Device Mgmt     │   │ Location Mgmt   │
    │                 │   │                 │   │                 │
    │ • Create users  │   │ • Assign device │   │ • Create loc.   │
    │ • Update users  │   │ • Device status │   │ • Update loc.   │
    │ • List users    │   │ • Device info   │   │ • List loc.     │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
                ▲                   ▲                   ▲
                │                   │                   │
        ┌───────────────────────────────────────────────────────┐
        │             COMPANY VALIDATION                        │
        │                                                       │
        │ • All operations validate company exists              │
        │ • Users can only manage entities in their company     │
        │ • Cross-company access blocked                        │
        └───────────────────────────────────────────────────────┘
                                    │
                                    ▼
    ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
    │   Attendance    │   │    Sessions     │   │   Analytics     │
    │                 │   │                 │   │                 │
    │ • Daily reports │   │ • Active sess.  │   │ • Attendance %  │
    │ • Monthly data  │   │ • Session hist. │   │ • Working hours │
    │ • Export CSV    │   │ • Heartbeats    │   │ • Trends        │
    └─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 🚨 **Error States & Solutions**

### **"Authorization token required" Error**
```
Problem: Trying to access protected endpoint without token
Solution: 
1. First create company (no auth needed)
2. Then login to get session token
3. Use token for subsequent requests
```

### **"User not found" Error**
```
Problem: No users exist in system yet
Solution:
1. Create company first
2. Create admin user (may need to temporarily disable auth)
3. Login with admin user
4. Create other users
```

### **"Company not found" Error**
```
Problem: Referenced company doesn't exist
Solution:
1. Create company first using POST /api/companies
2. Use returned company ID in subsequent operations
```

### **"Location proximity validation failed" Error**
```
Problem: User trying to login from wrong location
Solution:
1. Ensure user is within 100m of allocated location
2. Or remove allocatedLocationId if no location restriction needed
3. Check GPS accuracy and coordinates
```

## 📋 **Recommended Setup Sequence**

1. **🏢 Create Company** (No auth) → Get `companyId`
   ```bash
   POST /api/companies
   ```

2. **📱 Register Device** (No auth) → Get `deviceId` 
   ```bash
   POST /api/device/register
   ```

3. **👤 Create First Admin User** (No auth) → Get admin credentials
   ```bash
   POST /api/users/create-admin
   ```

4. **🔐 Login as Admin** (No restrictions) → Get session token
   ```bash
   POST /api/auth/login
   # Admin can use any device, any location
   ```

5. **📍 Create Locations** (With admin auth) → Get `locationId`
   ```bash
   POST /api/locations
   Authorization: Bearer <admin_token>
   ```

6. **👥 Create Employee Users** (With admin auth)
   ```bash
   POST /api/users
   Authorization: Bearer <admin_token>
   # Include role: "employee", assignedDeviceId, allocatedLocationId
   ```

7. **🔗 Assign Devices to Employees** (With admin auth)
   ```bash
   POST /api/admin/assign-device
   Authorization: Bearer <admin_token>
   ```

8. **📊 Normal Operations** (Role-based access)
   - **Admin**: Full system access, no location restrictions
   - **Employee**: Attendance tracking with location validation

Would you like me to help you follow this sequence or modify the authentication middleware further?