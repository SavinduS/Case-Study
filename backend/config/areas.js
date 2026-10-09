// Supported reporting areas (evaluation doc E2).
// Sector codes double as SMS area codes: "1 NORTHBOUNDARY".
const SECTORS = [
  { code: 'NORTHBOUNDARY', name: 'North Boundary', center: [81.42, 6.62], radiusMeters: 4000 },
  { code: 'EASTBOUNDARY', name: 'East Boundary', center: [81.52, 6.50], radiusMeters: 4000 },
  { code: 'SOUTHBOUNDARY', name: 'South Boundary', center: [81.40, 6.35], radiusMeters: 4000 },
  { code: 'WESTBOUNDARY', name: 'West Boundary', center: [81.28, 6.48], radiusMeters: 4000 }
];

const EARTH_RADIUS_M = 6378137;

function normalizeSectorCode(raw) {
  return String(raw || '').toUpperCase().replace(/[\s_-]/g, '');
}

function findSectorByCode(rawCode) {
  const code = normalizeSectorCode(rawCode);
  return SECTORS.find((s) => s.code === code) || null;
}

function distanceMeters([lng1, lat1], [lng2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function findSectorForPoint(lng, lat) {
  return SECTORS.find((s) => distanceMeters(s.center, [lng, lat]) <= s.radiusMeters) || null;
}

module.exports = {
  SECTORS,
  allowOutsideArea: process.env.ALLOW_OUTSIDE_AREA === 'true',
  normalizeSectorCode,
  findSectorByCode,
  findSectorForPoint,
  distanceMeters
};
