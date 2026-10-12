const { generateAnalytics } = require('../../services/analyticsService');
const ConflictReport = require('../../models/ConflictReport');
const PatrolRecord = require('../../models/PatrolRecord');
const ZoneSetting = require('../../models/ZoneSetting');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');

jest.setTimeout(60000);

// Member 2 — report generation aggregates the live database (no mocks).
const day = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * day);
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

let seq = 0;
const nextId = (prefix) => `${prefix}-${Date.now()}-${(seq += 1)}`;

async function seedIncident(incidentType, lngLat, createdAt) {
  return ConflictReport.create({
    reportId: nextId('CR'),
    incidentType,
    location: { type: 'Point', coordinates: lngLat },
    description: 'analytics test incident',
    createdAt
  });
}

async function seedPatrol(sector, start, hours) {
  return PatrolRecord.create({
    sector,
    startedAt: start,
    endedAt: new Date(start.getTime() + hours * 3600000)
  });
}

const NORTH = [81.42, 6.62]; // NORTHBOUNDARY centre

function criteria(overrides = {}) {
  return {
    startDate: isoDay(daysAgo(10)),
    endDate: isoDay(new Date()),
    zones: ['NORTHBOUNDARY'],
    categories: [],
    reportType: 'incidentSummary',
    ...overrides
  };
}

beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await resetTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

describe('POST /api/analytics/generate (service)', () => {
  test('aggregates incidents and patrol hours with coverage maths', async () => {
    await ZoneSetting.create({ code: 'NORTHBOUNDARY', name: 'North Boundary', requiredHours: 8 });
    const at = daysAgo(2);
    await seedIncident('elephant_sighting', NORTH, at);
    await seedIncident('elephant_sighting', NORTH, at);
    await seedIncident('crop_damage', NORTH, at);
    await seedPatrol('NORTHBOUNDARY', new Date(at.getTime() - 4 * 3600000), 4);

    const report = await generateAnalytics(criteria({ baseline: null }), null);

    expect(report.reportId).toMatch(/^AN-\d{4}-\d{6}$/);
    expect(report.summary.incidentCount).toBe(3);
    expect(report.summary.patrolCount).toBe(1);
    expect(report.incidentDensity.NORTHBOUNDARY).toBe(3);
    expect(report.patrolCoverage.NORTHBOUNDARY.actualHours).toBe(4);
    expect(report.patrolCoverage.NORTHBOUNDARY.requiredHours).toBe(8);
    expect(report.patrolCoverage.NORTHBOUNDARY.coveragePercent).toBe(50);
  });

  test('marks the report partial when patrol records are missing', async () => {
    await seedIncident('elephant_sighting', NORTH, daysAgo(2));

    const report = await generateAnalytics(criteria({ baseline: null }), null);

    expect(report.status).toBe('partial');
    expect(report.partialReasons.join(' ')).toMatch(/No patrol records/);
  });

  test('answers 422 honestly when no data exists for the period', async () => {
    const error = await generateAnalytics(criteria({ baseline: null }), null).catch((e) => e);
    expect(error.statusCode).toBe(422);
  });

  test('compares against the previous period with variance', async () => {
    const at = daysAgo(2);
    await seedIncident('elephant_sighting', NORTH, at);
    await seedIncident('elephant_sighting', NORTH, at);
    await seedIncident('elephant_sighting', NORTH, at);
    await seedIncident('crop_damage', NORTH, daysAgo(12)); // baseline window
    await seedPatrol('NORTHBOUNDARY', new Date(at.getTime() - 4 * 3600000), 4);

    const report = await generateAnalytics(criteria({ baseline: 'previous-period' }), null);

    expect(report.comparison.incidentCount).toMatchObject({ current: 3, baseline: 1, variance: 2 });
    expect(report.comparison.incidentDensity.NORTHBOUNDARY).toMatchObject({ current: 3, baseline: 1 });
  });

  test('recommends the highest-incident zone first', async () => {
    await seedIncident('elephant_sighting', NORTH, daysAgo(2));
    await seedPatrol('NORTHBOUNDARY', new Date(daysAgo(2).getTime() - 4 * 3600000), 4);

    const report = await generateAnalytics(criteria({ baseline: null }), null);

    expect(report.recommendations.join(' ')).toMatch(/NORTHBOUNDARY/);
  });
});
