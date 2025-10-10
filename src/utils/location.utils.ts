export interface LocationCoords {
  lat: number;
  lon: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 First location
 * @param point2 Second location
 * @returns Distance in meters
 */
export function calculateDistance(point1: LocationCoords, point2: LocationCoords): number {
  const R = 6371000; // Earth's radius in meters
  const lat1Rad = (point1.lat * Math.PI) / 180;
  const lat2Rad = (point2.lat * Math.PI) / 180;
  const deltaLatRad = ((point2.lat - point1.lat) * Math.PI) / 180;
  const deltaLonRad = ((point2.lon - point1.lon) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a point is within allowed locations
 * @param userLocation User's current location
 * @param allowedLocations Array of allowed locations with radius
 * @returns True if within any allowed location
 */
export function isWithinAllowedLocation(
  userLocation: LocationCoords,
  allowedLocations: Array<{ coords: { coordinates: [number, number] }; radiusMeters: number }>
): boolean {
  return allowedLocations.some(location => {
    const locationCoords = {
      lat: location.coords.coordinates[1],
      lon: location.coords.coordinates[0]
    };
    const distance = calculateDistance(userLocation, locationCoords);
    return distance <= location.radiusMeters;
  });
}

/**
 * Check if user is within their allocated location's proximity
 * @param userLocation User's current location
 * @param allocatedLocation User's specifically allocated location
 * @param proximityMeters Maximum allowed distance in meters (e.g., 100m)
 * @returns True if within allocated location proximity
 */
export function isWithinAllocatedLocation(
  userLocation: LocationCoords,
  allocatedLocation: { coords: { coordinates: [number, number] } },
  proximityMeters: number
): boolean {
  const locationCoords = {
    lat: allocatedLocation.coords.coordinates[1],
    lon: allocatedLocation.coords.coordinates[0]
  };
  const distance = calculateDistance(userLocation, locationCoords);
  return distance <= proximityMeters;
}