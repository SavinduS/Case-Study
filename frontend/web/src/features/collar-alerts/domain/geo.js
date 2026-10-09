const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg) => (deg * Math.PI) / 180;

/** Great-circle distance between two [lng, lat] points, in metres. */
export function haversineDistanceMeters([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Ray-casting point-in-polygon test for a [lng, lat] ring. */
export function pointInPolygon([lng, lat], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance from a point to a polygon's edge, in metres. */
export function distanceToPolygonMeters(point, ring) {
  let min = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    min = Math.min(min, distanceToSegmentMeters(point, ring[j], ring[i]));
  }
  return min;
}

/**
 * Perpendicular distance from `point` to segment a->b, in metres.
 * Uses an equirectangular projection, which is accurate enough at the
 * scale of a single park.
 */
function distanceToSegmentMeters(point, [ax, ay], [bx, by]) {
  const LAT_SCALE = 111_320;
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