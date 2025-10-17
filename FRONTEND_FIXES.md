# Frontend Fixes for BAMS Admin Dashboard

## ✅ Backend Updates Completed

The backend now returns enhanced session data with:
- ✅ `username` - User's email/username
- ✅ `userDisplayName` - User's display name
- ✅ `workingHours` - Total hours worked (decimal format, e.g., 8.50)
- ✅ `workingMinutes` - Total minutes worked
- ✅ `loginLocation` - Now safely handles null/undefined
- ✅ `logoutLocation` - Now included in response

**Updated API Response Example:**
```json
{
  "ok": true,
  "sessions": [
    {
      "sessionId": "68ef6fee70a878aac6cfd52c",
      "companyId": "68e8b206ef0b24a0867e1dab",
      "userId": "68e8b352ef0b24a0867e1dd9",
      "username": "ayush@bhishmasolutions.com",
      "userDisplayName": "Ayush V Nair",
      "deviceId": "DEVICE-MGRS40F7-U95L70",
      "loginAt": "2025-10-15T09:57:02.864Z",
      "logoutAt": "2025-10-15T10:04:59.670Z",
      "workingHours": 0.13,
      "workingMinutes": 8,
      "status": "logged_out",
      "lastHeartbeat": "2025-10-15T09:57:02.997Z",
      "loginLocation": {
        "lat": 9.9848322,
        "lon": 76.2826562,
        "accuracy": 11493.283967859903
      },
      "logoutLocation": null
    }
  ]
}
```

---

## 🔧 Frontend Fixes Required

### 1. Fix SessionsPage - Missing Key Prop

**Problem:** React warning about missing `key` prop in list rendering

**Location:** `src/components/SessionsPage.tsx` around line 203

**Fix:**
```tsx
// ❌ BEFORE (Missing key)
{sessions.map((session) => (
  <tr>
    <td>{session.sessionId}</td>
    ...
  </tr>
))}

// ✅ AFTER (With key prop)
{sessions.map((session) => (
  <tr key={session.sessionId}>
    <td>{session.sessionId}</td>
    ...
  </tr>
))}
```

**Complete Updated SessionsPage Table:**
```tsx
<tbody>
  {sessions.map((session) => (
    <tr key={session.sessionId}>
      <td>{session.userDisplayName}</td>
      <td>{session.username}</td>
      <td>{session.deviceId}</td>
      <td>{new Date(session.loginAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
      <td>{session.logoutAt ? new Date(session.logoutAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}</td>
      <td>{session.workingHours.toFixed(2)} hrs</td>
      <td>
        <span className={`status ${session.status}`}>
          {session.status}
        </span>
      </td>
      <td>
        {session.loginLocation 
          ? `${session.loginLocation.lat.toFixed(6)}, ${session.loginLocation.lon.toFixed(6)}`
          : '-'
        }
      </td>
    </tr>
  ))}
</tbody>
```

---

### 2. Fix LocationsPage - Undefined coordinates

**Problem:** `Cannot read properties of undefined (reading 'coordinates')`

**Location:** `src/components/LocationsPage.tsx` around line 229

**Issue:** The API returns `coords` object with nested `coordinates` array, but you might be accessing it incorrectly.

**Expected API Response:**
```json
{
  "ok": true,
  "locations": [
    {
      "_id": "location_id_here",
      "name": "Main Office",
      "coords": {
        "type": "Point",
        "coordinates": [77.594566, 12.971599]  // [longitude, latitude]
      },
      "radiusMeters": 100,
      "companyId": "company_id_here"
    }
  ]
}
```

**Fix - Add Null Checks:**
```tsx
// ❌ BEFORE (No safety checks)
{locations.map((location) => (
  <tr>
    <td>{location.name}</td>
    <td>{location.coords.coordinates[1]}, {location.coords.coordinates[0]}</td>
    <td>{location.radiusMeters}m</td>
  </tr>
))}

// ✅ AFTER (With safety checks and key)
{locations.map((location) => (
  <tr key={location._id}>
    <td>{location.name}</td>
    <td>
      {location.coords?.coordinates 
        ? `${location.coords.coordinates[1].toFixed(6)}, ${location.coords.coordinates[0].toFixed(6)}`
        : 'N/A'
      }
    </td>
    <td>{location.radiusMeters || 0}m</td>
    <td>{location.companyId || 'All Companies'}</td>
    <td>
      <button onClick={() => handleEdit(location)}>Edit</button>
      <button onClick={() => handleDelete(location._id)}>Delete</button>
    </td>
  </tr>
))}
```

**TypeScript Interface for Location:**
```typescript
interface Location {
  _id: string;
  name: string;
  coords: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  radiusMeters: number;
  companyId?: string;
  createdAt?: string;
}
```

---

### 3. Enhanced Sessions Table with Work Hours

**Recommended Complete SessionsPage Component:**

```tsx
import React, { useEffect, useState } from 'react';
import './SessionsPage.css';

interface Session {
  sessionId: string;
  companyId?: string;
  userId: string;
  username: string;
  userDisplayName: string;
  deviceId: string;
  loginAt: string;
  logoutAt?: string;
  workingHours: number;
  workingMinutes: number;
  status: 'active' | 'logged_out' | 'auto_logged_out' | 'expired';
  lastHeartbeat: string;
  loginLocation?: {
    lat: number;
    lon: number;
    accuracy: number;
  };
  logoutLocation?: {
    lat: number;
    lon: number;
    accuracy: number;
  };
}

export const SessionsPage: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [companyFilter, setCompanyFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    fetchSessions();
  }, [companyFilter, userFilter, statusFilter, fromDate, toDate]);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (companyFilter) params.append('companyId', companyFilter);
      if (userFilter) params.append('userId', userFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);

      const response = await fetch(`http://localhost:4000/api/sessions?${params}`);
      const data = await response.json();

      if (data.ok) {
        setSessions(data.sessions);
      } else {
        setError('Failed to fetch sessions');
      }
    } catch (err) {
      setError('Network error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'short',
      timeStyle: 'medium'
    });
  };

  const formatWorkHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="sessions-page">
      <h1>Sessions Management</h1>

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Filter by User ID"
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="logged_out">Logged Out</option>
          <option value="auto_logged_out">Auto Logged Out</option>
          <option value="expired">Expired</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          placeholder="From Date"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          placeholder="To Date"
        />
        <button onClick={fetchSessions}>Refresh</button>
      </div>

      {/* Loading/Error States */}
      {loading && <div className="loading">Loading sessions...</div>}
      {error && <div className="error">{error}</div>}

      {/* Sessions Table */}
      {!loading && !error && (
        <table className="sessions-table">
          <thead>
            <tr>
              <th>User Name</th>
              <th>Username</th>
              <th>Device</th>
              <th>Login Time (IST)</th>
              <th>Logout Time (IST)</th>
              <th>Work Hours</th>
              <th>Status</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center' }}>
                  No sessions found
                </td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.sessionId}>
                  <td>{session.userDisplayName}</td>
                  <td className="username">{session.username}</td>
                  <td>{session.deviceId}</td>
                  <td>{formatDateTime(session.loginAt)}</td>
                  <td>{session.logoutAt ? formatDateTime(session.logoutAt) : '-'}</td>
                  <td className="work-hours">
                    {session.workingHours > 0 ? formatWorkHours(session.workingHours) : '-'}
                  </td>
                  <td>
                    <span className={`status-badge status-${session.status}`}>
                      {session.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="location">
                    {session.loginLocation 
                      ? `${session.loginLocation.lat.toFixed(4)}, ${session.loginLocation.lon.toFixed(4)}`
                      : 'N/A'
                    }
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      {/* Summary Stats */}
      <div className="summary">
        <div className="stat">
          <strong>Total Sessions:</strong> {sessions.length}
        </div>
        <div className="stat">
          <strong>Active:</strong> {sessions.filter(s => s.status === 'active').length}
        </div>
        <div className="stat">
          <strong>Total Work Hours:</strong>{' '}
          {sessions.reduce((sum, s) => sum + s.workingHours, 0).toFixed(2)} hrs
        </div>
      </div>
    </div>
  );
};
```

---

### 4. CSS Styling for SessionsPage

**Add to `SessionsPage.css`:**

```css
.sessions-page {
  padding: 20px;
}

.filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filters input,
.filters select,
.filters button {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.filters button {
  background-color: #007bff;
  color: white;
  cursor: pointer;
}

.filters button:hover {
  background-color: #0056b3;
}

.sessions-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.sessions-table th,
.sessions-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.sessions-table th {
  background-color: #f8f9fa;
  font-weight: 600;
}

.sessions-table tr:hover {
  background-color: #f5f5f5;
}

.username {
  font-family: monospace;
  font-size: 0.9em;
}

.work-hours {
  font-weight: 600;
  color: #28a745;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: 500;
}

.status-active {
  background-color: #28a745;
  color: white;
}

.status-logged_out {
  background-color: #6c757d;
  color: white;
}

.status-auto_logged_out {
  background-color: #ffc107;
  color: black;
}

.status-expired {
  background-color: #dc3545;
  color: white;
}

.location {
  font-family: monospace;
  font-size: 0.85em;
  color: #666;
}

.summary {
  display: flex;
  gap: 30px;
  margin-top: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.summary .stat {
  display: flex;
  flex-direction: column;
}

.summary .stat strong {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 4px;
}

.loading,
.error {
  padding: 20px;
  text-align: center;
  border-radius: 4px;
}

.loading {
  background-color: #e7f3ff;
  color: #0056b3;
}

.error {
  background-color: #f8d7da;
  color: #721c24;
}
```

---

## 🚀 Testing the Updates

1. **Restart Backend Server** (if not already running in watch mode)
2. **Test Sessions API:**
   ```bash
   curl http://localhost:4000/api/sessions
   ```
3. **Verify new fields are present:**
   - ✅ `username`
   - ✅ `userDisplayName`
   - ✅ `workingHours`
   - ✅ `workingMinutes`

4. **Update Frontend:**
   - Fix the `key` prop in SessionsPage
   - Add null checks in LocationsPage
   - Update interfaces to match new API response

5. **Test in Browser:**
   - Navigate to Sessions page
   - Verify no React warnings in console
   - Verify work hours are displayed correctly
   - Test location page for coordinates display

---

## 📊 Updated API Documentation

All changes have been documented. The Sessions API now returns:

```typescript
interface SessionResponse {
  sessionId: string;
  companyId?: string;
  userId: string;
  username: string;           // NEW ✨
  userDisplayName: string;
  deviceId: string;
  loginAt: string;
  logoutAt?: string;
  workingHours: number;       // NEW ✨
  workingMinutes: number;     // NEW ✨
  status: string;
  lastHeartbeat: string;
  loginLocation: {
    lat: number;
    lon: number;
    accuracy: number;
  } | null;
  logoutLocation: {
    lat: number;
    lon: number;
    accuracy: number;
  } | null;
}
```

---

## 🎯 Quick Checklist

Backend (✅ Completed):
- ✅ Added `username` field to sessions response
- ✅ Added `userDisplayName` field
- ✅ Added `workingHours` calculation
- ✅ Added `workingMinutes` calculation
- ✅ Added null safety for locations
- ✅ Updated CSV export

Frontend (Your Tasks):
- ⬜ Add `key` prop to SessionsPage table rows
- ⬜ Add null checks in LocationsPage for `coords.coordinates`
- ⬜ Update TypeScript interfaces
- ⬜ Display work hours in sessions table
- ⬜ Test all pages for console errors

---

**Need Help?** Check the console logs and ensure your API calls match the updated response format!
