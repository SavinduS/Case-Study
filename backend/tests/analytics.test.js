const { parseCriteria, sectorForIncident } = require('../services/analyticsService');
const { SECTORS } = require('../config/areas');

describe('analytics criteria and sector assignment', () => {
  test('includes the complete end date as an exclusive next-day bound', () => {
    const criteria = parseCriteria({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      zones: [SECTORS[0].code],
      categories: ['poacher']
    });
    expect(criteria.endExclusive.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  test('rejects invalid zones and categories', () => {
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', zones: ['unknown']
    })).toThrow('zones');
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', categories: ['unknown']
    })).toThrow('categories');
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', zones: []
    })).toThrow('at least one terrain zone');
  });

  test('validates report types and baseline periods', () => {
    expect(parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02',
      reportType: 'terrainTrend', baseline: { startDate: '2025-12-30', endDate: '2025-12-31' }
    }).reportType).toBe('terrainTrend');
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', reportType: 'unknown'
    })).toThrow('reportType');
  });

  test('assigns an incident to the nearest configured sector', () => {
    const [lng, lat] = SECTORS[0].center;
    expect(sectorForIncident({ location: { coordinates: [lng, lat] } })).toBe(SECTORS[0].code);
  });
});
