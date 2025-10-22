export interface AppConfig {
  port: number;
  host: string;
  mongoUri: string;
  sessionTimeoutHours: number;
  heartbeatMinutes: number;
  heartbeatGraceFactor: number;
  autoLogoutCheckMinutes: number;
  locationProximityMeters: number;
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/attendance_monitoring',
  sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS || '12', 10),
  heartbeatMinutes: parseInt(process.env.HEARTBEAT_MINUTES || '5', 10),
  autoLogoutCheckMinutes: parseInt(process.env.AUTO_LOGOUT_CHECK_MINUTES || '5', 10),
  // Number of heartbeat intervals to wait before auto-logout. Default 2 -> e.g., 5min heartbeat => 10min grace
  // Allow fractional values like 1.5
  heartbeatGraceFactor: parseFloat(process.env.HEARTBEAT_GRACE_FACTOR || '2'),
  locationProximityMeters: parseInt(process.env.LOCATION_PROXIMITY_METERS || '100', 10),
});