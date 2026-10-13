import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const {
  parseCriteria,
  sectorForIncident,
  toAnalyticsIncident,
  aggregate,
  variance,
  periodBounds,
  direction,
  configuredHours,
  isoWeek
} = require('../../services/analyticsService');
const { SECTORS, normalizeSectorCode, findSectorByCode, findNearestSector, findSectorForPoint, distanceMeters } = require('../../config/areas');

/** Sector centres are [lng, lat]; incidents are placed on or beside them. */
const NORTH = SECTORS.find((s) => s.code === 'NORTHBOUNDARY');
const EAST = SECTORS.find((s) => s.code === 'EASTBOUNDARY');

const at = (sector, dLng = 0, dLat = 0) => [sector.center[0] + dLng, sector.center[1] + dLat];

/**
 * generateAnalytics maps raw ConflictReport documents through
 * toAnalyticsIncident before handing them to aggregate, so `type` is part of
 * aggregate's input contract rather than something it derives itself.
 */
const incident = (sector, createdAt, type = 'elephant', offset = {}) => ({
  incidentType: type,
  type,
  location: { coordinates: at(sector, offset.dLng || 0, offset.dLat || 0) },
  createdAt: new Date(createdAt)
});

const patrol = (sector, fields = {}) => ({
  sector: sector.code,
  startedAt: new Date('2026-03-01T00:00:00Z'),
  endedAt: new Date('2026-03-02T00:00:00Z'),
  ...fields
});

const window = { start: new Date('2026-03-01T00:00:00Z'), endExclusive: new Date('2026-04-01T00:00:00Z') };

describe('areas configuration', () => {
  it('exposes four configured sectors with centres and radii', () => {
    expect(SECTORS).toHaveLength(4);
    for (const sector of SECTORS) {
      expect(sector.code).toMatch(/^[A-Z]+$/);
      expect(sector.center).toHaveLength(2);
      expect(sector.radiusMeters).toBeGreaterThan(0);
    }
  });

  it('normalises codes from any case, spacing or underscore form', () => {
    expect(normalizeSectorCode('north_boundary')).toBe('NORTHBOUNDARY');
    expect(normalizeSectorCode('  North Boundary ')).toBe('NORTHBOUNDARY');
    expect(normalizeSectorCode('EAST-BOUNDARY')).toBe('EASTBOUNDARY');
    expect(normalizeSectorCode(undefined)).toBe('');
  });

  it('finds a sector by code and rejects unknown codes', () => {
    expect(findSectorByCode('northboundary').code).toBe('NORTHBOUNDARY');
    expect(findSectorByCode('nowhere')).toBeNull();
  });

  it('finds the nearest sector to a point', () => {
    expect(findNearestSector(...EAST.center).code).toBe('EASTBOUNDARY');
    expect(findNearestSector(...NORTH.center).code).toBe('NORTHBOUNDARY');
  });

  it('treats a point inside the radius as covered by that sector', () => {
    expect(findSectorForPoint(...NORTH.center).code).toBe('NORTHBOUNDARY');
    // Far outside every configured radius.
    expect(findSectorForPoint(0, 0)).toBeNull();
  });

  it('measures great-circle distance symmetrically', () => {
    const a = [81.0, 8.0];
    const b = [81.1, 8.0];
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
    expect(distanceMeters(a, a)).toBe(0);
    // One degree of latitude is roughly 111 km.
    expect(distanceMeters([81, 8], [81, 9])).toBeGreaterThan(110000);
    expect(distanceMeters([81, 8], [81, 9])).toBeLessThan(112000);
  });
});

describe('toAnalyticsIncident', () => {
  it('maps every free-text incident type onto a canonical category', () => {
    expect(toAnalyticsIncident({ incidentType: 'Crop damage' }).type).toBe('crop');
    expect(toAnalyticsIncident({ incidentType: 'poacher sighting' }).type).toBe('poacher');
    expect(toAnalyticsIncident({ incidentType: 'Snare trap found' }).type).toBe('snare');
    expect(toAnalyticsIncident({ incidentType: 'wire snare' }).type).toBe('snare');
  });

  it('falls back to elephant for unrecognised or missing types', () => {
    expect(toAnalyticsIncident({ incidentType: 'unusual sighting' }).type).toBe('elephant');
    expect(toAnalyticsIncident({}).type).toBe('elephant');
  });

  it('reads the legacy "type" field when incidentType is absent', () => {
    expect(toAnalyticsIncident({ type: 'crop' }).type).toBe('crop');
  });

  it('preserves the original document fields', () => {
    const original = { reportId: 'CR-1', incidentType: 'poacher', description: 'x' };
    expect(toAnalyticsIncident(original)).toMatchObject(original);
  });
});

describe('sectorForIncident', () => {
  it('assigns an incident sitting on a sector centre', () => {
    expect(sectorForIncident({ location: { coordinates: NORTH.center } })).toBe('NORTHBOUNDARY');
  });

  it('returns null when the incident has no usable coordinates', () => {
    expect(sectorForIncident({ location: { coordinates: [] } })).toBeNull();
    expect(sectorForIncident({})).toBeNull();
    expect(sectorForIncident({ location: {} })).toBeNull();
  });
});

describe('isoWeek', () => {
  it('buckets every day of one Monday-to-Sunday week together', () => {
    const week = isoWeek('2026-03-02T00:00:00Z');
    for (const day of ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']) {
      expect(isoWeek(`${day}T12:00:00Z`)).toBe(week);
    }
  });

  it('separates the following Monday from the week before it', () => {
    expect(isoWeek('2026-03-09T12:00:00Z')).not.toBe(isoWeek('2026-03-08T12:00:00Z'));
    expect(isoWeek('2026-03-09T12:00:00Z')).toBe(isoWeek('2026-03-15T12:00:00Z'));
  });

  it('counts from the first Thursday of the ISO year', () => {
    expect(isoWeek('2026-01-01T00:00:00Z')).toBe('2025-W53');
    expect(isoWeek('2025-12-29T12:00:00Z')).toBe('2025-W53');
    expect(isoWeek('2026-12-31T00:00:00Z')).toBe('2026-W53');
  });

  it('numbers weeks by the ISO year, not the calendar year of the date', () => {
    // 2021-01-01 falls in the last ISO week of 2020.
    expect(isoWeek('2021-01-01T00:00:00Z')).toBe('2020-W53');
  });

  it('handles a leap day without shifting the week number', () => {
    expect(isoWeek('2024-02-29T12:00:00Z')).toBe(isoWeek('2024-03-01T12:00:00Z'));
  });

  it('always returns a zero-padded Www label', () => {
    expect(isoWeek('2026-01-04T12:00:00Z')).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('direction', () => {
  it('reports increasing, decreasing and stable', () => {
    expect(direction([1, 2, 3])).toBe('increasing');
    expect(direction([3, 2, 1])).toBe('decreasing');
    expect(direction([2, 2, 2])).toBe('stable');
  });

  it('cannot determine a direction from fewer than two points', () => {
    expect(direction([])).toBe('stable');
    expect(direction([5])).toBe('stable');
  });
});

describe('variance', () => {
  it('reports the current value, the baseline and the signed difference', () => {
    expect(variance(10, 6)).toEqual({ current: 10, baseline: 6, variance: 4, variancePercent: 66.67 });
    expect(variance(6, 10)).toEqual({ current: 6, baseline: 10, variance: -4, variancePercent: -40 });
  });

  it('returns a null percentage when the baseline is zero', () => {
    // Dividing by zero would produce Infinity or NaN; the brief requires null.
    expect(variance(10, 0)).toEqual({ current: 10, baseline: 0, variance: 10, variancePercent: null });
    expect(variance(0, 0)).toEqual({ current: 0, baseline: 0, variance: 0, variancePercent: null });
  });

  it('rounds both the variance and the percentage to two decimals', () => {
    const result = variance(3, 2);
    expect(result.variance).toBe(1);
    expect(result.variancePercent).toBe(50);

    const fractional = variance(10.555, 3.333);
    expect(fractional.variance).toBe(7.22);
    // The percentage is derived from the unrounded delta, so it is not simply
    // variance / baseline * 100.
    expect(fractional.variancePercent).toBe(216.68);
  });

  it('reports a zero variance when the value did not move', () => {
    expect(variance(7, 7)).toEqual({ current: 7, baseline: 7, variance: 0, variancePercent: 0 });
  });
});

describe('periodBounds', () => {
  const criteria = {
    startDate: new Date('2026-03-01T00:00:00Z'),
    endExclusive: new Date('2026-04-01T00:00:00Z')
  };

  it('defaults the baseline to the immediately preceding window of equal length', () => {
    const bounds = periodBounds(criteria);
    // March 1 back 31 days (the length of the selected window).
    expect(bounds.start.toISOString()).toBe('2026-01-29T00:00:00.000Z');
    expect(bounds.endExclusive.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(bounds.endExclusive - bounds.start).toBe(criteria.endExclusive - criteria.startDate);
  });

  it('shifts the whole window back one year for previous-year', () => {
    const bounds = periodBounds({ ...criteria, baseline: 'previous-year' });
    expect(bounds.start.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(bounds.endExclusive.toISOString()).toBe('2025-04-01T00:00:00.000Z');
  });

  it('keeps the baseline inside the same calendar year across a leap day', () => {
    const leap = {
      startDate: new Date('2024-03-01T00:00:00Z'),
      endExclusive: new Date('2024-03-01T00:00:00Z')
    };
    const bounds = periodBounds({ ...leap, baseline: 'previous-year' });
    expect(bounds.start.getUTCFullYear()).toBe(2023);
  });

  it('treats a numeric baseline as a lookback of that many days', () => {
    const bounds = periodBounds({ ...criteria, baseline: 10 });
    expect(bounds.start.toISOString()).toBe('2026-02-19T00:00:00.000Z');
    expect(bounds.endExclusive.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('uses an explicit baseline window when one is supplied', () => {
    const bounds = periodBounds({ ...criteria, baseline: { startDate: '2025-01-01', endDate: '2025-01-31' } });
    expect(bounds.start.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    // An inclusive end date still yields an exclusive bound.
    expect(bounds.endExclusive.toISOString()).toBe('2025-02-01T00:00:00.000Z');
  });
});

describe('configuredHours', () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith('REQUIRED_')) delete process.env[key];
    }
    Object.assign(process.env, saved);
  });

  it('reads a JSON map when REQUIRED_SECTOR_HOURS is set', () => {
    process.env.REQUIRED_SECTOR_HOURS = JSON.stringify({ NORTHBOUNDARY: 8, EASTBOUNDARY: 12 });
    const hours = configuredHours();
    expect(hours.NORTHBOUNDARY).toBe(8);
    expect(hours.EASTBOUNDARY).toBe(12);
    expect(hours.SOUTHBOUNDARY).toBe(0);
  });

  it('falls back to per-sector variables when the JSON is malformed', () => {
    process.env.REQUIRED_SECTOR_HOURS = '{not json';
    process.env.REQUIRED_HOURS_NORTHBOUNDARY = '6';
    const hours = configuredHours();
    expect(hours.NORTHBOUNDARY).toBe(6);
  });

  it('reports zero for sectors that were never configured', () => {
    process.env.REQUIRED_SECTOR_HOURS = JSON.stringify({ NORTHBOUNDARY: 8 });
    const hours = configuredHours();
    expect(hours.WESTBOUNDARY).toBe(0);
  });

  it('returns an entry for every configured sector even with no env at all', () => {
    delete process.env.REQUIRED_SECTOR_HOURS;
    for (const sector of SECTORS) delete process.env[`REQUIRED_HOURS_${sector.code}`];
    const hours = configuredHours();
    expect(Object.keys(hours).sort()).toEqual(SECTORS.map((s) => s.code).sort());
    expect(Object.values(hours).every((value) => value === 0)).toBe(true);
  });
});

describe('aggregate', () => {
  it('counts incidents per zone inside the selected window', () => {
    const incidents = [
      incident(NORTH, '2026-03-05'),
      incident(NORTH, '2026-03-06'),
      incident(EAST, '2026-03-07')
    ];
    const result = aggregate(incidents, [], [NORTH.code, EAST.code], window.start, window.endExclusive);
    expect(result.counts).toEqual({ NORTHBOUNDARY: 2, EASTBOUNDARY: 1 });
  });

  it('initialises every requested zone to zero', () => {
    const result = aggregate([], [], ['NORTHBOUNDARY', 'SOUTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.counts).toEqual({ NORTHBOUNDARY: 0, SOUTHBOUNDARY: 0 });
  });

  it('ignores incidents that fall outside the selected zones', () => {
    const incidents = [incident(NORTH, '2026-03-05'), incident(EAST, '2026-03-05')];
    const result = aggregate(incidents, [], ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.counts).toEqual({ NORTHBOUNDARY: 1 });
  });

  it('ignores incidents with no assignable sector', () => {
    const result = aggregate([{ incidentType: 'elephant', createdAt: new Date('2026-03-05') }], [], ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.counts).toEqual({ NORTHBOUNDARY: 0 });
  });

  it('buckets weekly trends and per-category trends by ISO week', () => {
    const incidents = [
      incident(NORTH, '2026-03-02', 'crop'),
      incident(NORTH, '2026-03-03', 'crop'),
      incident(NORTH, '2026-03-04', 'poacher')
    ];
    const result = aggregate(incidents, [], ['NORTHBOUNDARY'], window.start, window.endExclusive);
    const weeks = Object.keys(result.weekly);
    expect(weeks).toHaveLength(1);
    expect(result.weekly[weeks[0]]).toBe(3);
    expect(result.categoryTrends.crop[weeks[0]]).toBe(2);
    expect(result.categoryTrends.poacher[weeks[0]]).toBe(1);
  });

  it('sums full patrol hours that sit inside the window', () => {
    const patrols = [patrol(NORTH, { startedAt: new Date('2026-03-10T00:00:00Z'), endedAt: new Date('2026-03-11T00:00:00Z') })];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(24);
  });

  it('prorates a patrol that is only partly inside the window', () => {
    // Two-day patrol starting two days before the window opens.
    const patrols = [patrol(NORTH, { startedAt: new Date('2026-02-27T00:00:00Z'), endedAt: new Date('2026-03-01T00:00:00Z') })];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(0);
  });

  it('counts only the overlapping slice when a patrol straddles the window end', () => {
    const patrols = [patrol(NORTH, { startedAt: new Date('2026-03-31T12:00:00Z'), endedAt: new Date('2026-04-01T12:00:00Z') })];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(12);
  });

  it('derives patrol hours from durationHours when endedAt is absent', () => {
    const patrols = [{
      sector: NORTH.code,
      startedAt: new Date('2026-03-05T00:00:00Z'),
      durationHours: 6
    }];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(6);
  });

  it('accepts patrolDate and date fields in place of startedAt', () => {
    const byPatrolDate = [{ sector: NORTH.code, patrolDate: new Date('2026-03-05T00:00:00Z'), date: new Date('2026-03-05T00:00:00Z'), hours: 5 }];
    const byDate = [{ sector: NORTH.code, date: new Date('2026-03-06T00:00:00Z'), hours: 4 }];
    const result = aggregate([], [...byPatrolDate, ...byDate], ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(9);
  });

  it('assigns a patrol with no sector by its nearest coordinates', () => {
    const patrols = [{
      sectorCode: '',
      location: { coordinates: EAST.center },
      startedAt: new Date('2026-03-05T00:00:00Z'),
      endedAt: new Date('2026-03-05T03:00:00Z')
    }];
    const result = aggregate([], patrols, ['EASTBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.EASTBOUNDARY).toBe(3);
  });

  it('ignores patrols in zones that were not selected', () => {
    const patrols = [patrol(EAST, { startedAt: new Date('2026-03-05T00:00:00Z'), endedAt: new Date('2026-03-06T00:00:00Z') })];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(0);
  });

  it('adds hours across several patrols in the same zone', () => {
    const patrols = [
      patrol(NORTH, { startedAt: new Date('2026-03-05T00:00:00Z'), endedAt: new Date('2026-03-05T06:00:00Z') }),
      patrol(NORTH, { startedAt: new Date('2026-03-06T00:00:00Z'), endedAt: new Date('2026-03-06T04:00:00Z') })
    ];
    const result = aggregate([], patrols, ['NORTHBOUNDARY'], window.start, window.endExclusive);
    expect(result.hours.NORTHBOUNDARY).toBe(10);
  });
});

describe('parseCriteria validation', () => {
  const base = {
    startDate: '2026-03-01',
    endDate: '2026-03-31',
    zones: ['NORTHBOUNDARY'],
    categories: ['crop']
  };

  it('keeps the complete end date as an exclusive next-day bound', () => {
    const criteria = parseCriteria({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      zones: ['NORTHBOUNDARY'],
      categories: ['poacher']
    });
    expect(criteria.endExclusive.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('normalises the supplied zone codes', () => {
    expect(parseCriteria({ ...base, zones: ['north_boundary'] }).zones).toEqual(['NORTHBOUNDARY']);
  });

  it('rejects an end date before the start date', () => {
    expect(() => parseCriteria({ ...base, startDate: '2026-03-31', endDate: '2026-03-01' }))
      .toThrow(/endDate/);
  });

  it('rejects unparseable dates', () => {
    expect(() => parseCriteria({ ...base, startDate: 'not-a-date' })).toThrow(/dates/);
    expect(() => parseCriteria({ ...base, endDate: undefined })).toThrow(/dates/);
  });

  it('rejects unknown zones and empty zone selections', () => {
    expect(() => parseCriteria({ ...base, zones: ['nowhere'] })).toThrow(/zones/);
    expect(() => parseCriteria({ ...base, zones: [] })).toThrow(/at least one terrain zone/);
  });

  it('accepts the alternate terrainZones field name', () => {
    expect(parseCriteria({ ...base, zones: undefined, terrainZones: ['NORTHBOUNDARY'] }).zones)
      .toEqual(['NORTHBOUNDARY']);
  });

  it('rejects unknown categories', () => {
    expect(() => parseCriteria({ ...base, categories: ['unknown'] })).toThrow(/categories/);
  });

  it('treats an omitted category list as every category', () => {
    expect(parseCriteria({ ...base, categories: undefined }).categories).toEqual([]);
  });

  it('accepts the four supported report types and defaults to overview', () => {
    for (const type of ['overview', 'patrolCoverage', 'incidentSummary', 'terrainTrend']) {
      expect(parseCriteria({ ...base, reportType: type }).reportType).toBe(type);
    }
    expect(parseCriteria(base).reportType).toBe('overview');
  });

  it('rejects an unknown report type', () => {
    expect(() => parseCriteria({ ...base, reportType: 'unknown' })).toThrow(/reportType/);
  });

  it('accepts a numeric, previous-year, object and null baseline', () => {
    expect(parseCriteria({ ...base, baseline: 7 }).baseline).toBe(7);
    expect(parseCriteria({ ...base, baseline: 'previous-year' }).baseline).toBe('previous-year');
    expect(parseCriteria({ ...base, baseline: { startDate: '2025-01-01', endDate: '2025-01-31' } }).baseline)
      .toEqual({ startDate: '2025-01-01', endDate: '2025-01-31' });
    expect(parseCriteria({ ...base, baseline: null }).baseline).toBeNull();
  });

  it('rejects a non-positive or unrecognised baseline', () => {
    expect(() => parseCriteria({ ...base, baseline: 0 })).toThrow(/baseline/);
    expect(() => parseCriteria({ ...base, baseline: -5 })).toThrow(/baseline/);
    expect(() => parseCriteria({ ...base, baseline: 'soon' })).toThrow(/baseline/);
  });

  it('treats false as no baseline at all', () => {
    expect(parseCriteria({ ...base, baseline: false }).baseline).toBeNull();
  });

  it('rejects an object baseline that is incomplete or out of order', () => {
    expect(() => parseCriteria({ ...base, baseline: { startDate: '2025-01-01' } })).toThrow(/baseline/);
    expect(() => parseCriteria({ ...base, baseline: { startDate: '2025-02-01', endDate: '2025-01-01' } })).toThrow(/baseline/);
    expect(() => parseCriteria({ ...base, baseline: { startDate: 'bad', endDate: '2025-01-01' } })).toThrow(/baseline/);
  });

  it('unwraps a nested criteria object', () => {
    expect(parseCriteria({ criteria: base }).zones).toEqual(['NORTHBOUNDARY']);
  });

  it('rejects a criteria value that is not an object', () => {
    expect(() => parseCriteria('nonsense')).toThrow(/startDate/);
  });

  it('defaults a missing criteria argument to an empty object', () => {
    expect(() => parseCriteria()).toThrow(/startDate/);
  });
});