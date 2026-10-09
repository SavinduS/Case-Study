const { buildDuplicateQuery, DUPLICATE_RADIUS_M, DUPLICATE_WINDOW_MS } = require('../utils/duplicate');
const { findSectorByCode, findSectorForPoint, distanceMeters, normalizeSectorCode } = require('../config/areas');

describe('duplicate detection rules (FR-15 / E4)', () => {
  const now = Date.UTC(2026, 0, 15, 12, 0, 0);

  test('matches same type within 500 m and 30 minutes', () => {
    const q = buildDuplicateQuery({ incidentType: 'crop_damage', coordinates: [81.42, 6.62], now });
    expect(q.incidentType).toBe('crop_damage');
    expect(q.createdAt.$gte).toEqual(new Date(now - DUPLICATE_WINDOW_MS));
    expect(q.location.$geoWithin.$centerSphere[1]).toBeCloseTo(DUPLICATE_RADIUS_M / 6378137, 10);
    expect(q.location.$geoWithin.$centerSphere[0]).toEqual([81.42, 6.62]);
  });
});

describe('supported reporting areas (E2)', () => {
  test('sector lookup normalizes codes', () => {
    expect(normalizeSectorCode('north_boundary')).toBe('NORTHBOUNDARY');
    expect(findSectorByCode('North Boundary').name).toBe('North Boundary');
    expect(findSectorByCode('nowhere')).toBeNull();
  });

  test('point inside a sector is found, outside returns null', () => {
    expect(findSectorForPoint(81.42, 6.62)).not.toBeNull();
    expect(findSectorForPoint(0, 0)).toBeNull();
  });

  test('distance is zero for identical points and grows with separation', () => {
    expect(distanceMeters([81.42, 6.62], [81.42, 6.62])).toBe(0);
    const d = distanceMeters([81.42, 6.62], [81.52, 6.62]);
    expect(d).toBeGreaterThan(9000);
    expect(d).toBeLessThan(13000);
  });
});
