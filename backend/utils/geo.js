const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Sample geo helper (used by geofence + incident location)
function isValidLngLat(lng, lat) {
  return typeof lng === 'number' && typeof lat === 'number'
    && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/** Great-circle distance between two [lng, lat] points, in metres. */
function haversineDistanceMeters([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Ray-casting point-in-polygon test for a [lng, lat] ring. */
function pointInPolygon([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Perpendicular distance from a point to segment a->b, in metres. */
function distanceToSegmentMeters(point, [ax, ay], [bx, by]) {
  const LAT_SCALE = 111320;
  const px = (lng) => lng * LAT_SCALE * Math.cos(toRad(point[1]));
  const py = (lat) => lat * LAT_SCALE;

  const [x, y] = [px(point[0]), py(point[1])];
  const [ax2, ay2] = [px(ax), py(ay)];
  const [bx2, by2] = [px(bx), py(by)];

  const dx = bx2 - ax2;
  const dy = by2 - ay2;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x - ax2, y - ay2);

  const t = Math.max(0, Math.min(1, ((x - ax2) * dx + (y - ay2) * dy) / lengthSq));
  return Math.hypot(x - (ax2 + t * dx), y - (ay2 + t * dy));
}

/** Shortest distance from a [lng, lat] point to a polygon's edge, in metres. */
function distanceToPolygonMeters(point, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    min = Math.min(min, distanceToSegmentMeters(point, ring[j], ring[i]));
  }
  return min;
}

module.exports = {
  isValidLngLat,
  haversineDistanceMeters,
  pointInPolygon,
  distanceToSegmentMeters,
  distanceToPolygonMeters
};