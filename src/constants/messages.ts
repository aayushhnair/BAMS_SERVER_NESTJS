export const MESSAGES = {
  AUTH: {
    INVALID_CREDENTIALS: { message: 'Invalid username or password. Please check your credentials and try again.', error: 'INVALID_CREDENTIALS', status: 401 },
    DEVICE_NOT_ASSIGNED: { message: 'You are not authorized to login from this device. Please use your assigned device or contact your administrator.', error: 'DEVICE_NOT_ASSIGNED', status: 403 },
    NO_DEVICE_ASSIGNED: { message: 'No device has been assigned to your account. Please contact your administrator to assign a device.', error: 'NO_DEVICE_ASSIGNED', status: 403 },
    SESSION_NOT_FOUND: { message: 'Session not found. Please login again.', error: 'SESSION_NOT_FOUND', status: 401 },
  },
  LOCATION: {
    ALLOCATED_LOCATION_NOT_FOUND: { message: 'Your allocated location could not be found. Please contact your administrator.', error: 'ALLOCATED_LOCATION_NOT_FOUND', status: 500 },
    NOT_WITHIN_ALLOCATED_LOCATION: (name: string, meters: number) => ({ message: `You must be within ${meters} meters of ${name} to login. Please move closer to your assigned location.`, error: 'NOT_WITHIN_ALLOCATED_LOCATION', status: 403 }),
    NO_LOCATIONS_CONFIGURED: { message: 'No locations are configured for your company. Please contact your administrator to set up allowed locations.', error: 'NO_LOCATIONS_CONFIGURED', status: 403 },
    LOCATION_NOT_ALLOWED: { message: 'You are not within any allowed location. Please move to one of your company\'s registered locations to login.', error: 'LOCATION_NOT_ALLOWED', status: 403 }
  },
  HEARTBEAT: {
    DEVICE_MISMATCH: { message: 'Device mismatch detected. Please login again from the correct device.', error: 'DEVICE_MISMATCH', status: 403 },
    SESSION_NOT_ACTIVE: (status: string) => ({ message: `Your session is ${status}. Please login again.`, error: 'SESSION_NOT_ACTIVE', status: 401 }),
    SESSION_EXPIRED: (hours: number) => ({ message: `Your session has exceeded the maximum duration of ${hours} hours. Please login again.`, error: 'SESSION_EXPIRED', status: 401 }),
    HEARTBEAT_TIMEOUT: (inactiveMinutes: number, expectedIntervalMinutes: number) => ({ message: `Your session timed out due to inactivity (no heartbeat for ${inactiveMinutes} minutes). Please login again.`, error: 'HEARTBEAT_TIMEOUT', status: 401, inactiveMinutes, expectedIntervalMinutes }),
    UPDATED: { message: 'Heartbeat updated successfully', status: 200 }
  },
  GENERIC: {
    INTERNAL_ERROR: { message: 'Internal server error', error: 'INTERNAL_ERROR', status: 500 }
  }
};

export default MESSAGES;
