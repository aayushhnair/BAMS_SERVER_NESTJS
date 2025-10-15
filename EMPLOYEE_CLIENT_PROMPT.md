# BAMS Employee Desktop Client - Complete Development Specification

## Project Overview
Build a cross-platform desktop application using **Electron** (HTML/CSS/JavaScript/Node.js) for the BAMS (Bhishma Attendance Monitoring System) employee client. This application handles employee authentication, location-based check-ins, session verification, and automated heartbeat monitoring.

---

## 🎨 Application Design & Branding

### Theme & Colors
- **Primary Colors**: Red (#DC143C), Yellow (#FFD700), Blue (#1E90FF)
- **Brand Name**: BAMS (Bhishma Attendance Monitoring System)
- **Logo**: Include placeholder for company logo in header
- **UI Style**: Modern, clean, professional corporate design

### Window Specifications
- **Default Size**: 800x600px
- **Resizable**: Yes
- **Minimize to Tray**: Yes
- **Always on Top**: Optional toggle
- **Frame**: Custom branded frame with BAMS colors

---

## 🔧 Core Technical Requirements

### 1. Device ID Management

**On First Startup:**
```javascript
// Generate unique device identifier
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function generateDeviceId() {
  const deviceIdPath = path.join(app.getPath('userData'), 'deviceId.json');
  
  // Check if device ID already exists
  if (fs.existsSync(deviceIdPath)) {
    const data = JSON.parse(fs.readFileSync(deviceIdPath, 'utf8'));
    return data.deviceId;
  }
  
  // Generate new device ID
  let deviceId;
  try {
    // Try to get machine UUID (Windows: WMIC, Mac: ioreg, Linux: /etc/machine-id)
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      deviceId = execSync('wmic csproduct get uuid').toString().split('\n')[1].trim();
    } else if (process.platform === 'darwin') {
      deviceId = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString().split('=')[1].trim().replace(/"/g, '');
    } else {
      deviceId = fs.readFileSync('/etc/machine-id', 'utf8').trim();
    }
  } catch (error) {
    // Fallback: hostname + random suffix
    const hostname = os.hostname();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    deviceId = `${hostname}-${random}`;
  }
  
  // Persist device ID
  fs.writeFileSync(deviceIdPath, JSON.stringify({ deviceId, createdAt: new Date().toISOString() }));
  
  return deviceId;
}
```

---

## 📡 Backend API Integration

### Base Configuration
```javascript
// config.json
{
  "api": {
    "baseUrl": "http://localhost:4000",  // Change to production URL
    "timeout": 10000,
    "retryAttempts": 3
  },
  "app": {
    "heartbeatInterval": 1800000,        // 30 minutes in milliseconds
    "locationUpdateInterval": 30000,     // 30 seconds
    "timezone": "Asia/Kolkata",          // IST timezone
    "autoStart": false,
    "minimizeToTray": true
  }
}
```

---

## 🔐 API Endpoints for Employee Client

### 1. Login API

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "username": "employee@company.com",
  "password": "plaintext_password",
  "deviceId": "DESKTOP-ABC123-4F2A9B",
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

// Device Not Assigned (403)
{
  "ok": false,
  "error": "NOT_ASSIGNED"
}

// Outside Allocated Location (403)
{
  "ok": false,
  "error": "NOT_WITHIN_ALLOCATED_LOCATION"
}

// Not in Any Company Location (403)
{
  "ok": false,
  "error": "LOCATION_NOT_ALLOWED"
}

// No Locations Configured (403)
{
  "ok": false,
  "error": "NO_LOCATIONS_CONFIGURED"
}
```

**Implementation Example:**
```javascript
async function login(username, password, deviceId, location) {
  try {
    const response = await fetch(`${config.api.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, deviceId, location })
    });
    
    const data = await response.json();
    
    if (response.ok && data.ok) {
      // Store session data
      sessionStorage.setItem('sessionId', data.sessionId);
      sessionStorage.setItem('username', username);
      sessionStorage.setItem('loginTime', new Date().toISOString());
      
      return { success: true, sessionId: data.sessionId, expiresIn: data.expiresIn };
    } else {
      return { success: false, error: data.error || data.message };
    }
  } catch (error) {
    return { success: false, error: 'Network error: ' + error.message };
  }
}
```

---

### 2. Session Verification API

**Endpoint:** `POST /api/auth/verify-session`

**Request Body:**
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
    "deviceId": "DESKTOP-ABC123-4F2A9B",
    "loginAt": "2025-10-15T09:30:00.000Z",
    "lastHeartbeat": "2025-10-15T10:00:00.000Z",
    "status": "active"
  },
  "user": {
    "_id": "user_id_here",
    "username": "employee@company.com",
    "displayName": "Employee Name",
    "role": "employee",
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

// OR

{
  "ok": false,
  "valid": false,
  "error": "Session is not active",
  "status": "logged_out"
}

// OR

{
  "ok": false,
  "valid": false,
  "error": "Session expired",
  "expiredAt": "2025-10-15T21:30:00.000Z"
}
```

**Usage:**
- Call this API on application startup to check if user has an active session
- Periodically verify session validity (every 5 minutes)
- Auto-redirect to login if session is invalid

**Implementation Example:**
```javascript
async function verifySession(sessionId) {
  try {
    const response = await fetch(`${config.api.baseUrl}/api/auth/verify-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    
    const data = await response.json();
    
    if (data.ok && data.valid) {
      return {
        valid: true,
        user: data.user,
        expiresIn: data.expiresIn
      };
    } else {
      return {
        valid: false,
        error: data.error
      };
    }
  } catch (error) {
    return { valid: false, error: 'Network error: ' + error.message };
  }
}
```

---

### 3. Heartbeat API

**Endpoint:** `POST /api/heartbeat`

**Request Body:**
```json
{
  "sessionId": "68ef6fb870a878aac6cfd521",
  "deviceId": "DESKTOP-ABC123-4F2A9B",
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

**Implementation:**
```javascript
// Start heartbeat interval after successful login
let heartbeatTimer;

function startHeartbeat(sessionId, deviceId) {
  // Clear any existing timer
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  
  // Send heartbeat every 30 minutes
  heartbeatTimer = setInterval(async () => {
    const location = await getCurrentLocation();
    
    try {
      const response = await fetch(`${config.api.baseUrl}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, deviceId, location })
      });
      
      const data = await response.json();
      
      if (response.status === 401) {
        // Session expired or invalid - logout user
        showError('Session expired. Please login again.');
        logout();
      } else if (data.ok) {
        console.log('Heartbeat sent successfully');
        updateLastHeartbeatDisplay(new Date());
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
      // Don't logout on network errors - retry on next interval
    }
  }, config.app.heartbeatInterval);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
```

---

### 4. Logout API

**Endpoint:** `POST /api/auth/logout`

**Request Body:**
```json
{
  "sessionId": "68ef6fb870a878aac6cfd521",
  "deviceId": "DESKTOP-ABC123-4F2A9B",
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

**Error Responses:**
```json
// Session Not Found (404)
{
  "statusCode": 404,
  "message": "Session not found"
}

// Device Mismatch (403)
{
  "statusCode": 403,
  "message": "Device mismatch"
}

// Session Already Closed (400)
{
  "statusCode": 400,
  "message": "Session already closed"
}
```

**Implementation:**
```javascript
async function logout() {
  const sessionId = sessionStorage.getItem('sessionId');
  const deviceId = getDeviceId();
  const location = await getCurrentLocation();
  
  try {
    const response = await fetch(`${config.api.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, deviceId, location })
    });
    
    const data = await response.json();
    
    // Clear local session regardless of response
    sessionStorage.clear();
    stopHeartbeat();
    
    if (data.ok) {
      showMessage('Logged out successfully');
    }
    
    // Redirect to login screen
    showLoginScreen();
  } catch (error) {
    // Best-effort logout - clear local data anyway
    console.error('Logout error:', error);
    sessionStorage.clear();
    stopHeartbeat();
    showLoginScreen();
  }
}
```

---

## 📍 Geolocation Implementation

### HTML5 Geolocation API
```javascript
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// Auto-update location display
function startLocationUpdates() {
  updateLocationDisplay();
  
  setInterval(() => {
    updateLocationDisplay();
  }, config.app.locationUpdateInterval); // Every 30 seconds
}

async function updateLocationDisplay() {
  try {
    const location = await getCurrentLocation();
    document.getElementById('latitude').textContent = location.lat.toFixed(6);
    document.getElementById('longitude').textContent = location.lon.toFixed(6);
    document.getElementById('accuracy').textContent = Math.round(location.accuracy) + 'm';
  } catch (error) {
    document.getElementById('latitude').textContent = 'Error';
    document.getElementById('longitude').textContent = error.message;
  }
}
```

---

## ⏰ IST Time Display

### Live IST Clock
```javascript
function updateISTClock() {
  const now = new Date();
  
  // Format in IST
  const istTime = now.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: true,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  document.getElementById('ist-clock').textContent = istTime;
}

// Update every second
setInterval(updateISTClock, 1000);
updateISTClock();
```

### Session Duration Timer
```javascript
function startSessionTimer(loginTime) {
  const loginTimestamp = new Date(loginTime).getTime();
  
  setInterval(() => {
    const now = Date.now();
    const duration = now - loginTimestamp;
    
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    
    document.getElementById('session-duration').textContent = 
      `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, 1000);
}
```

---

## 🖥️ User Interface States

### Login Screen HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>BAMS - Employee Login</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-placeholder">
        <img src="assets/logo.png" alt="BAMS Logo">
      </div>
      <h1>BAMS</h1>
      <p class="subtitle">Bhishma Attendance Monitoring System</p>
    </div>
    
    <div class="login-form">
      <div class="device-info">
        <label>Device ID:</label>
        <input type="text" id="device-id" readonly>
      </div>
      
      <div class="location-info">
        <label>Current Location:</label>
        <div class="location-display">
          <span>Lat: <span id="latitude">Loading...</span></span>
          <span>Lon: <span id="longitude">Loading...</span></span>
          <span>Accuracy: <span id="accuracy">--</span></span>
        </div>
      </div>
      
      <input type="text" id="username" placeholder="Username/Email" required>
      <input type="password" id="password" placeholder="Password" required>
      
      <button id="login-btn" class="primary-btn">Login</button>
      
      <div id="error-message" class="error" style="display: none;"></div>
      <div id="status-message" class="status"></div>
    </div>
  </div>
  
  <script src="js/login.js"></script>
</body>
</html>
```

### Dashboard Screen HTML
```html
<!DOCTYPE html>
<html>
<head>
  <title>BAMS - Dashboard</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-placeholder">
        <img src="assets/logo.png" alt="BAMS Logo">
      </div>
      <h1>BAMS</h1>
    </div>
    
    <div class="dashboard">
      <div class="welcome">
        <h2>Welcome, <span id="user-name">Employee</span></h2>
        <div class="status-indicator online">
          <span class="status-dot"></span>
          <span>Online</span>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-card">
          <label>Current Time (IST)</label>
          <div id="ist-clock" class="time-display">--:--:--</div>
        </div>
        
        <div class="info-card">
          <label>Session Duration</label>
          <div id="session-duration" class="time-display">00:00:00</div>
        </div>
        
        <div class="info-card">
          <label>Current Location</label>
          <div class="location-display-small">
            <span id="lat-display">--</span>, <span id="lon-display">--</span>
          </div>
        </div>
        
        <div class="info-card">
          <label>Last Heartbeat</label>
          <div id="last-heartbeat">Never</div>
        </div>
      </div>
      
      <div class="actions">
        <button id="logout-btn" class="danger-btn">Logout</button>
        <button id="minimize-btn" class="secondary-btn">Minimize to Tray</button>
      </div>
      
      <div id="status-message" class="status"></div>
    </div>
  </div>
  
  <script src="js/dashboard.js"></script>
</body>
</html>
```

---

## 🎨 CSS Styling (styles.css)

```css
:root {
  --primary-red: #DC143C;
  --primary-yellow: #FFD700;
  --primary-blue: #1E90FF;
  --bg-light: #F5F5F5;
  --bg-dark: #2C3E50;
  --text-dark: #333;
  --text-light: #FFF;
  --success: #28A745;
  --error: #DC3545;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: linear-gradient(135deg, var(--primary-blue) 0%, var(--bg-dark) 100%);
  color: var(--text-dark);
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.3);
  width: 500px;
  padding: 30px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  border-bottom: 3px solid var(--primary-yellow);
  padding-bottom: 20px;
}

.logo-placeholder {
  width: 80px;
  height: 80px;
  margin: 0 auto 15px;
  background: var(--primary-red);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  color: white;
}

.logo-placeholder img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

h1 {
  color: var(--primary-red);
  font-size: 2.5em;
  margin-bottom: 5px;
}

.subtitle {
  color: var(--primary-blue);
  font-size: 0.9em;
}

.device-info, .location-info {
  margin-bottom: 15px;
  padding: 10px;
  background: var(--bg-light);
  border-radius: 5px;
}

.device-info label, .location-info label {
  font-weight: bold;
  color: var(--primary-blue);
  display: block;
  margin-bottom: 5px;
}

.device-info input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  font-family: 'Courier New', monospace;
}

.location-display {
  display: flex;
  justify-content: space-between;
  font-size: 0.9em;
  color: var(--text-dark);
}

input[type="text"], input[type="password"] {
  width: 100%;
  padding: 12px;
  margin-bottom: 15px;
  border: 2px solid #ddd;
  border-radius: 5px;
  font-size: 1em;
  transition: border 0.3s;
}

input:focus {
  outline: none;
  border-color: var(--primary-blue);
}

.primary-btn {
  width: 100%;
  padding: 12px;
  background: var(--primary-red);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1.1em;
  cursor: pointer;
  transition: background 0.3s;
}

.primary-btn:hover {
  background: #B01030;
}

.danger-btn {
  padding: 10px 20px;
  background: var(--error);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-right: 10px;
}

.secondary-btn {
  padding: 10px 20px;
  background: #6C757D;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.error {
  background: #FFE6E6;
  color: var(--error);
  padding: 10px;
  border-radius: 5px;
  margin-top: 10px;
  border-left: 4px solid var(--error);
}

.status {
  text-align: center;
  margin-top: 10px;
  font-size: 0.9em;
  color: #666;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.status-indicator.online {
  color: var(--success);
}

.status-dot {
  width: 12px;
  height: 12px;
  background: var(--success);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin: 20px 0;
}

.info-card {
  background: var(--bg-light);
  padding: 15px;
  border-radius: 8px;
  text-align: center;
}

.info-card label {
  display: block;
  color: var(--primary-blue);
  font-weight: bold;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.time-display {
  font-size: 1.5em;
  font-weight: bold;
  color: var(--primary-red);
  font-family: 'Courier New', monospace;
}

.actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
```

---

## 🔒 System Event Handling

### Auto-Logout on System Events
```javascript
const { powerMonitor, app } = require('electron');

// Monitor system events
function setupSystemEventHandlers(mainWindow) {
  // Screen lock detection
  powerMonitor.on('lock-screen', async () => {
    console.log('Screen locked - logging out user');
    await performLogout();
  });
  
  // System suspend
  powerMonitor.on('suspend', async () => {
    console.log('System suspending - logging out user');
    await performLogout();
  });
  
  // System shutdown
  powerMonitor.on('shutdown', async (event) => {
    event.preventDefault();
    console.log('System shutting down - logging out user');
    await performLogout();
    app.quit();
  });
  
  // Window close
  mainWindow.on('close', async (event) => {
    event.preventDefault();
    console.log('Window closing - logging out user');
    await performLogout();
    mainWindow.destroy();
    app.quit();
  });
}

async function performLogout() {
  const sessionId = global.sessionId;
  const deviceId = global.deviceId;
  
  if (!sessionId) return;
  
  try {
    const location = await getCurrentLocation();
    
    await fetch(`${config.api.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, deviceId, location }),
      timeout: 5000
    });
  } catch (error) {
    console.error('Logout failed during system event:', error);
  }
}
```

---

## 📁 Project Structure

```
bams-employee-client/
├── package.json
├── main.js                         # Electron main process
├── preload.js                      # Preload script for security
├── config/
│   ├── config.json                 # Application configuration
│   └── .env.example                # Environment variables template
├── src/
│   ├── renderer/
│   │   ├── login.html
│   │   ├── dashboard.html
│   │   ├── css/
│   │   │   └── styles.css
│   │   └── js/
│   │       ├── login.js
│   │       ├── dashboard.js
│   │       ├── api.js              # API communication
│   │       ├── geolocation.js      # Location services
│   │       └── utils.js
│   └── main/
│       ├── tray.js                 # System tray management
│       ├── power-monitor.js        # System events
│       └── updater.js              # Auto-updates
├── assets/
│   ├── icons/
│   │   ├── icon.ico                # Windows icon
│   │   ├── icon.png                # Mac/Linux icon
│   │   └── tray.png                # Tray icon
│   └── logo.png                    # BAMS logo
└── README.md
```

---

## 📦 package.json

```json
{
  "name": "bams-employee-client",
  "version": "1.0.0",
  "description": "BAMS Employee Attendance Client",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:win": "electron-builder --win",
    "build:mac": "electron-builder --mac",
    "build:linux": "electron-builder --linux"
  },
  "author": "Bhishma Solutions",
  "license": "MIT",
  "dependencies": {
    "electron-log": "^5.0.0",
    "electron-updater": "^6.0.0",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "electron": "^27.0.0",
    "electron-builder": "^24.0.0"
  },
  "build": {
    "appId": "com.bhishma.bams-employee",
    "productName": "BAMS Employee",
    "win": {
      "target": ["nsis"],
      "icon": "assets/icons/icon.ico"
    },
    "mac": {
      "target": ["dmg"],
      "icon": "assets/icons/icon.icns"
    },
    "linux": {
      "target": ["AppImage"],
      "icon": "assets/icons/icon.png"
    }
  }
}
```

---

## 🚀 Main Process (main.js)

```javascript
const { app, BrowserWindow, ipcMain, Tray, Menu, powerMonitor } = require('electron');
const path = require('path');
const log = require('electron-log');

let mainWindow;
let tray;

// Configuration
const config = require('./config/config.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(__dirname, 'assets/icons/icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  mainWindow.loadFile('src/renderer/login.html');

  // System tray
  createTray();

  // Power monitoring
  setupPowerMonitoring();

  // Prevent multiple instances
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets/icons/tray.png'));
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: 'Quit',
      click: async () => {
        // Perform logout before quitting
        mainWindow.webContents.send('logout-request');
        setTimeout(() => app.quit(), 2000);
      }
    }
  ]);

  tray.setToolTip('BAMS Employee Client');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.show();
  });
}

function setupPowerMonitoring() {
  powerMonitor.on('lock-screen', () => {
    log.info('Screen locked - triggering logout');
    mainWindow.webContents.send('system-event', 'lock');
  });

  powerMonitor.on('suspend', () => {
    log.info('System suspending - triggering logout');
    mainWindow.webContents.send('system-event', 'suspend');
  });

  powerMonitor.on('shutdown', (e) => {
    e.preventDefault();
    log.info('System shutting down - triggering logout');
    mainWindow.webContents.send('system-event', 'shutdown');
    setTimeout(() => app.quit(), 2000);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

---

## ✨ Additional Features to Implement

1. **Offline Queue**: Store heartbeats when offline, sync when online
2. **Settings Panel**: Configure heartbeat interval, auto-start, theme
3. **Notification System**: Show desktop notifications for important events
4. **Session Recovery**: Auto-login if valid session exists
5. **Idle Detection**: Warn user before auto-logout on inactivity
6. **Update Checker**: Auto-update mechanism for new versions
7. **Error Logging**: Comprehensive logging for debugging
8. **Multi-language Support**: i18n for different languages
9. **Dark Mode**: Toggle between light and dark themes
10. **About Dialog**: Version info, credits, support information

---

## 🎯 Development Checklist

- [ ] Setup Electron project structure
- [ ] Implement device ID generation and persistence
- [ ] Create login UI with BAMS branding
- [ ] Integrate HTML5 Geolocation API
- [ ] Implement login API integration
- [ ] Add session verification on startup
- [ ] Create dashboard UI with IST clock
- [ ] Implement heartbeat timer (30 min intervals)
- [ ] Add logout functionality
- [ ] Setup system event handlers (lock, sleep, shutdown)
- [ ] Implement system tray functionality
- [ ] Add error handling and user feedback
- [ ] Create configuration management system
- [ ] Implement logging system
- [ ] Test all API endpoints
- [ ] Build Windows installer
- [ ] Prepare for code signing
- [ ] Create user documentation

---

## 🔐 Security Notes

1. **No Client-Side Password Hashing**: Send plaintext passwords over HTTPS only
2. **HTTPS Only**: All API communication must use HTTPS in production
3. **Certificate Validation**: Properly validate SSL certificates
4. **Session Storage**: Keep session data in memory, not localStorage
5. **Auto-Logout**: Implement multiple logout triggers for security
6. **Device Binding**: Ensure sessionId is validated with deviceId

---

This comprehensive specification provides everything needed to build a professional, secure, and user-friendly BAMS employee desktop client using Electron.
