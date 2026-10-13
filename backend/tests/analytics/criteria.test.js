const { parseCriteria } = require('../../services/analyticsService');
const { SECTORS } = require('../../config/areas');

// Member 2 — report criteria parsing and validation (no database needed).
describe('analytics report criteria', () => {
  test('includes the complete end date as an exclusive next-day bound', () => {
    const criteria = parseCriteria({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      zones: [SECTORS[0].code],
      categories: ['poacher']
    });
    expect(criteria.endExclusive.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  test('defaults an omitted report type to overview', () => {
    const criteria = parseCriteria({ startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(criteria.reportType).toBe('overview');
  });

  test('accepts the terrainZones alias and normalises codes', () => {
    const criteria = parseCriteria({
      startDate: '2026-01-01',
      endDate: '2026-01-02',
      terrainZones: ['north_boundary']
    });
    expect(criteria.zones).toEqual(['NORTHBOUNDARY']);
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

  test('rejects missing or unordered dates', () => {
    expect(() => parseCriteria({ endDate: '2026-01-02' })).toThrow('startDate and endDate');
    expect(() => parseCriteria({ startDate: '2026-01-05', endDate: '2026-01-02' }))
      .toThrow('endDate must be on or after startDate');
  });

  test('validates report types and baseline periods', () => {
    expect(parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02',
      reportType: 'terrainTrend', baseline: { startDate: '2025-12-30', endDate: '2025-12-31' }
    }).reportType).toBe('terrainTrend');
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', reportType: 'unknown'
    })).toThrow('reportType');
    expect(parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', baseline: 'previous-period'
    }).baseline).toBe('previous-period');
    expect(() => parseCriteria({
      startDate: '2026-01-01', endDate: '2026-01-02', baseline: -3
    })).toThrow('baseline');
  });
});
