// MongoDB initialization script
db = db.getSiblingDB('attendance_monitoring');

// Create sample company
db.companies.insertOne({
  _id: 'C1',
  name: 'Transvigour',
  timezone: 'Asia/Kolkata',
  settings: {
    sessionTimeoutHours: 12,
    heartbeatMinutes: 5
  }
});

// Create sample admin user
db.users.insertOne({
  _id: 'U1',
  companyId: 'C1',
  username: 'admin',
  password: 'admin123',
  displayName: 'System Administrator',
  role: 'admin'
});

// Create sample employee user
db.users.insertOne({
  _id: 'U2',
  companyId: 'C1',
  username: 'john.doe',
  password: 'password123',
  displayName: 'John Doe',
  assignedDeviceId: 'D-001',
  role: 'employee'
});

// Create sample device
db.devices.insertOne({
  _id: 'D-001',
  deviceId: 'D-001',
  serial: 'SN123456',
  name: 'PC-MAIN',
  companyId: 'C1',
  assignedTo: 'U2',
  lastSeen: new Date()
});

// Create sample location
db.locations.insertOne({
  _id: 'L1',
  companyId: 'C1',
  name: 'Main Office',
  coords: {
    type: 'Point',
    coordinates: [77.12345, 9.12345] // [longitude, latitude]
  },
  radiusMeters: 150
});

// Create indexes
db.users.createIndex({ companyId: 1, username: 1 }, { unique: true });
db.devices.createIndex({ deviceId: 1 }, { unique: true });
db.locations.createIndex({ coords: '2dsphere' });
db.sessions.createIndex({ userId: 1, loginAt: -1 });

print('Database initialized with sample data');