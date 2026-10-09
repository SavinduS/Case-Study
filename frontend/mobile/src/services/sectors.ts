// Client mirror of backend/config/areas.js — used to label the incident
// location on the form ("North Boundary Sector").
export interface Sector {
  code: string;
  name: string;
  center: [number, number];
  radiusMeters: number;
}

export const SECTORS: Sector[] = [
  { code: 'NORTHBOUNDARY', name: 'North Boundary', center: [81.42, 6.62], radiusMeters: 4000 },
  { code: 'EASTBOUNDARY', name: 'East Boundary', center: [81.52, 6.5], radiusMeters: 4000 },
  { code: 'SOUTHBOUNDARY', name: 'South Boundary', center: [81.4, 6.35], radiusMeters: 4000 },
  { code: 'WESTBOUNDARY', name: 'West Boundary', center: [81.28, 6.48], radiusMeters: 4000 }
];

const EARTH_RADIUS_M = 6378137;

export function distanceMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function sectorForPoint(lng: number, lat: number): Sector | null {
  return SECTORS.find((s) => distanceMeters(s.center, [lng, lat]) <= s.radiusMeters) || null;
}

export function sectorLabel(lng: number, lat: number): string | null {
  return sectorForPoint(lng, lat)?.name ?? null;
}
