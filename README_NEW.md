# Attendance Monitoring System Backend

A minimal NestJS server with MongoDB for attendance tracking with device and location-based authentication.

## Features

- Device registration and assignment
- Location-based authentication using Haversine distance calculation
- Session management with automatic logout
- Heartbeat monitoring
- Export functionality (CSV/JSON)
- Background job for auto-logout after session timeout

## Quick Start

### Using Docker Compose (Recommended)

1. **Clone and navigate to the project:**
```bash
cd bas-backend
```

2. **Start the services:**
```bash
docker-compose up -d
```

This will start:
- MongoDB on port 27017
- NestJS application on port 3000

3. **Check if services are running:**
```bash
docker-compose ps
```

### Manual Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Setup MongoDB:**
   - Install MongoDB locally or use MongoDB Atlas
   - Update `.env` file with your MongoDB URI

3. **Start the development server:**
```bash
npm run start:dev
```

## API Endpoints

The server will be available at `http://localhost:3000`

### Authentication
- `POST /api/auth/login` - User login with location verification
- `POST /api/auth/logout` - User logout

### Device Management
- `POST /api/device/register` - Register a new device
- `POST /api/admin/assign-device` - Assign device to user (admin)

### Session Management
- `POST /api/heartbeat` - Update session activity
- `GET /api/sessions` - Get session logs
- `GET /api/export` - Export session data

### Location Management
- `POST /api/locations` - Add allowed location (admin)
- `GET /api/locations` - List allowed locations

### User Management
- `POST /api/users` - Create new employee/user account
- `GET /api/users` - List users with filtering
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user information
- `DELETE /api/users/:id` - Delete user account

### Company Management
- `POST /api/companies` - Create new company
- `GET /api/companies` - List all companies
- `GET /api/companies/:id` - Get specific company
- `PUT /api/companies/:id` - Update company information

## Sample Data

The MongoDB initialization script creates sample data:

**Admin User:**
- Username: `admin`
- Password: `admin123`

**Employee User:**
- Username: `john.doe`
- Password: `password123`
- Assigned Device: `D-001`

**Sample Location:**
- Name: "Main Office"
- Coordinates: [77.12345, 9.12345]
- Radius: 150 meters

## Configuration

Environment variables (`.env`):

```env
PORT=3000
HOST=localhost
MONGO_URI=mongodb://localhost:27017/attendance_monitoring
SESSION_TIMEOUT_HOURS=12
HEARTBEAT_MINUTES=5
AUTO_LOGOUT_CHECK_MINUTES=5
```

## Database Collections

- **companies** - Company information and settings
- **users** - User accounts with device assignments
- **devices** - Registered devices
- **locations** - Allowed locations with geo-coordinates
- **sessions** - Login sessions with location tracking

## Location-Based Authentication

The system uses the Haversine formula to calculate distance between user location and allowed company locations. Users must be within the specified radius of any allowed location to successfully login.

## Auto-Logout

A background cron job runs every 5 minutes to automatically logout sessions that:
- Have exceeded the session timeout (default: 12 hours)
- Haven't sent a heartbeat within the heartbeat timeout (default: 15 minutes)

## Development

```bash
# Development
npm run start:dev

# Build
npm run build

# Production
npm run start:prod

# Testing
npm run test
```

## Docker Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f app

# Rebuild after code changes
docker-compose up -d --build
```