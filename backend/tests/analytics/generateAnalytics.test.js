import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

const { generateAnalytics, sectorForIncident } = require('../../services/analyticsService');
const PatrolRecord = require('../../models/PatrolRecord');
const AnalyticsReport = require('../../models/AnalyticsReport');
const AuditEntry = require('../../models/AuditEntry');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');
const {
  NORTH, EAST, criteria, conflictReport, patrolRecord, completeDataset, seedConflicts, ConflictReport
} = require('./fixtures');
const mongoose = require('mongoose');

/**
 * generateAnalytics is the single decision point for the reports workspace, so
 * these cases run against the dedicated test database rather than against
 * stubs: the aggregation queries, the atomic report counter and the persistence
 * all have to work together for the report to come back.
 */

const seed = async (docs) => {
  if (docs.incidents?.length) await seedConflicts(docs.incidents);
  if (docs.patrols?.length) await PatrolRecord.insertMany(docs.patrols);
};

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  // disconnectTestDb already closes the connection and drops the test database.
  await disconnectTestDb();
});

describe('generateAnalytics', () => {
  it('builds a complete report when incidents and patrols both exist', async () => {
    await seed(completeDataset());

    const report = await generateAnalytics(criteria());

    expect(report.status).toBe('complete');
    expect(report.partialReasons).toEqual([]);
    expect(report.summary.incidentCount).toBe(3);
    expect(report.summary.patrolCount).toBe(1);
  });

  it('persists the report with the criteria it was generated from', async () => {
    await seed(completeDataset());

    const report = await generateAnalytics(criteria({ reportType: 'incidentSummary' }));

    const stored = await AnalyticsReport.findOne({ reportId: report.reportId }).lean();
    expect(stored).toBeTruthy();
    expect(stored.criteria.reportType).toBe('incidentSummary');
    expect(stored.criteria.zones).toEqual([NORTH.code]);
    expect(stored.criteria.startDate).toEqual(new Date('2026-03-01T00:00:00.000Z'));
  });

  it('allocates a report reference of the form AN-YYYY-NNNNNN', async () => {
    await seed(completeDataset());

    const report = await generateAnalytics(criteria());

    expect(report.reportId).toMatch(/^AN-\d{4}-\d{6}$/);
    expect(report.reportId.startsWith(`AN-${new Date().getUTCFullYear()}-`)).toBe(true);
  });

  it('issues a distinct reference to each successive report', async () => {
    await seed(completeDataset());

    const ids = new Set();
    for (let i = 0; i < 3; i += 1) {
      const report = await generateAnalytics(criteria());
      ids.add(report.reportId);
    }
    expect(ids.size).toBe(3);
  });

  it('counts incidents per zone and leaves unselected zones at zero', async () => {
    await seed({
      incidents: [
        conflictReport({ sector: NORTH, at: '2026-03-02T09:00:00Z' }),
        conflictReport({ sector: EAST, at: '2026-03-03T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ zones: [NORTH.code, EAST.code] }));

    expect(report.incidentDensity).toEqual({ NORTHBOUNDARY: 1, EASTBOUNDARY: 1 });
  });

  it('groups incidents into ISO weeks on the trend axis', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2026-03-04T09:00:00Z' }),
        conflictReport({ at: '2026-03-10T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    const weeks = Object.keys(report.weeklyTrends);

    expect(weeks).toHaveLength(2);
    expect(report.weeklyTrends[weeks[0]]).toBe(2);
    expect(report.weeklyTrends[weeks[1]]).toBe(1);
  });

  it('records the direction of the incident trend', async () => {
    // Weekly buckets rise from one incident to three across the window, so the
    // first and last points differ and the direction is increasing.
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2026-03-10T09:00:00Z' }),
        conflictReport({ at: '2026-03-17T09:00:00Z' }),
        conflictReport({ at: '2026-03-18T09:00:00Z' }),
        conflictReport({ at: '2026-03-19T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    expect(report.terrainTrend.direction).toBe('increasing');
  });

  it('applies the category filter to the incidents it counts', async () => {
    await seed({
      incidents: [
        conflictReport({ incidentType: 'crop_damage', at: '2026-03-02T09:00:00Z' }),
        // Not part of the crop category, so the filter must exclude it.
        conflictReport({ incidentType: 'elephant_sighting', at: '2026-03-03T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ categories: ['crop'] }));
    expect(report.summary.incidentCount).toBe(1);
  });

  it('sums patrol hours for the selected zones', async () => {
    await seed({
      patrols: [
        patrolRecord({ sector: NORTH, startedAt: '2026-03-05T00:00:00Z', endedAt: '2026-03-05T06:00:00Z' }),
        patrolRecord({ sector: NORTH, startedAt: '2026-03-06T00:00:00Z', endedAt: '2026-03-06T04:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    expect(report.patrolCoverage.NORTHBOUNDARY.actualHours).toBe(10);
  });

  it('marks the report partial when patrol records are missing', async () => {
    await seed({ incidents: completeDataset().incidents });

    const report = await generateAnalytics(criteria());

    expect(report.status).toBe('partial');
    expect(report.partialReasons.join(' ')).toMatch(/patrol/i);
  });

  it('marks the report partial when incident records are missing', async () => {
    await seed({ patrols: completeDataset().patrols });

    const report = await generateAnalytics(criteria());

    expect(report.status).toBe('partial');
    expect(report.partialReasons.join(' ')).toMatch(/incident/i);
  });

  it('reports per-zone coverage gaps as partial reasons', async () => {
    // A single one-day patrol leaves the rest of the 31-day period uncovered.
    await seed({
      patrols: [patrolRecord({ sector: NORTH, startedAt: '2026-03-10T00:00:00Z', endedAt: '2026-03-11T00:00:00Z' })]
    });

    const report = await generateAnalytics(criteria({ zones: [NORTH.code] }));

    expect(report.status).toBe('partial');
    expect(report.partialReasons.join(' ')).toMatch(/NORTHBOUNDARY: 30 day\(s\)/);
  });

  it('rejects a period that holds neither incidents nor patrols', async () => {
    await expect(generateAnalytics(criteria())).rejects.toMatchObject({ statusCode: 422 });
    await expect(generateAnalytics(criteria())).rejects.toThrow(/No incident or patrol data/);
  });

  it('still builds a report when only patrols exist for the period', async () => {
    await seed({ patrols: completeDataset().patrols });

    const report = await generateAnalytics(criteria());
    expect(report.summary.patrolCount).toBe(1);
    expect(report.summary.incidentCount).toBe(0);
    expect(report.status).toBe('partial');
  });

  it('compares against the previous equivalent-length period by default', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2026-03-03T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ baseline: 'previous-period' }));

    expect(report.comparison.incidentCount.current).toBe(2);
    expect(report.comparison.incidentCount.baseline).toBe(0);
    // A zero baseline must not produce a percentage.
    expect(report.comparison.incidentCount.variancePercent).toBeNull();
    expect(report.comparison.incidentCount.variance).toBe(2);
  });

  it('compares against the same window one year earlier', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2025-03-02T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ baseline: 'previous-year' }));

    expect(report.comparison.incidentCount.current).toBe(1);
    expect(report.comparison.incidentCount.baseline).toBe(1);
    expect(report.comparison.incidentCount.variance).toBe(0);
  });

  it('compares against an explicit baseline window', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2026-01-15T09:00:00Z' }),
        conflictReport({ at: '2026-01-16T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(
      criteria({ baseline: { startDate: '2026-01-01', endDate: '2026-01-31' } })
    );

    expect(report.comparison.incidentCount.current).toBe(1);
    expect(report.comparison.incidentCount.baseline).toBe(2);
    expect(report.comparison.incidentCount.variance).toBe(-1);
  });

  it('omits the comparison entirely when no baseline is selected', async () => {
    await seed({ incidents: completeDataset().incidents });

    const report = await generateAnalytics(criteria());
    expect(report.comparison).toBeNull();
  });

  it('varies incident density and patrol hours per zone', async () => {
    await seed({
      incidents: [conflictReport({ sector: NORTH, at: '2026-03-02T09:00:00Z' })],
      patrols: [patrolRecord({ sector: NORTH, startedAt: '2026-03-02T00:00:00Z', endedAt: '2026-03-02T08:00:00Z' })]
    });

    const report = await generateAnalytics(
      criteria({
        zones: [NORTH.code, EAST.code],
        baseline: { startDate: '2026-01-01', endDate: '2026-01-31' }
      })
    );

    expect(report.comparison.incidentDensity.NORTHBOUNDARY).toMatchObject({ current: 1, baseline: 0 });
    expect(report.comparison.patrolHours.NORTHBOUNDARY).toMatchObject({ current: 8, baseline: 0 });
  });

  it('recommends more patrol hours where coverage is below the requirement', async () => {
    process.env.REQUIRED_SECTOR_HOURS = JSON.stringify({ NORTHBOUNDARY: 100 });
    await seed({
      patrols: [patrolRecord({ sector: NORTH, startedAt: '2026-03-01T00:00:00Z', endedAt: '2026-03-02T00:00:00Z' })]
    });

    const report = await generateAnalytics(criteria());

    expect(report.recommendations.join(' ')).toMatch(/Increase patrol coverage in NORTHBOUNDARY/);
    delete process.env.REQUIRED_SECTOR_HOURS;
  });

  it('names the zone with the highest incident count', async () => {
    await seed({
      incidents: [
        conflictReport({ sector: NORTH, at: '2026-03-02T09:00:00Z' }),
        conflictReport({ sector: NORTH, at: '2026-03-03T09:00:00Z' }),
        conflictReport({ sector: EAST, at: '2026-03-04T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ zones: [NORTH.code, EAST.code] }));
    expect(report.recommendations.join(' ')).toMatch(/Prioritize ranger deployments in NORTHBOUNDARY/);
  });

  it('recommends more patrols when the trend is increasing', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-02T09:00:00Z' }),
        conflictReport({ at: '2026-03-10T09:00:00Z' }),
        conflictReport({ at: '2026-03-17T09:00:00Z' }),
        conflictReport({ at: '2026-03-18T09:00:00Z' }),
        conflictReport({ at: '2026-03-19T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    expect(report.recommendations.join(' ')).toMatch(/Incident activity is increasing/);
  });

  it('shapes the output section according to the report type', async () => {
    await seed(completeDataset());

    const incident = await generateAnalytics(criteria({ reportType: 'incidentSummary' }));
    expect(Object.keys(incident.output)).toEqual(['incidentDensity', 'categoryTrends', 'comparison']);

    const patrol = await generateAnalytics(criteria({ reportType: 'patrolCoverage' }));
    expect(Object.keys(patrol.output)).toEqual(['patrolCoverage', 'gaps']);

    const terrain = await generateAnalytics(criteria({ reportType: 'terrainTrend' }));
    expect(Object.keys(terrain.output)).toEqual(['terrainTrend']);

    const overview = await generateAnalytics(criteria({ reportType: 'overview' }));
    expect(Object.keys(overview.output)).toEqual(
      expect.arrayContaining(['summary', 'patrolCoverage', 'incidentDensity', 'terrainTrend', 'recommendations'])
    );
  });

  it('records the direction of every category trend', async () => {
    await seed({
      incidents: [
        conflictReport({ incidentType: 'crop_damage', at: '2026-03-02T09:00:00Z' }),
        conflictReport({ incidentType: 'crop_damage', at: '2026-03-10T09:00:00Z' }),
        conflictReport({ incidentType: 'crop_damage', at: '2026-03-17T09:00:00Z' }),
        conflictReport({ incidentType: 'crop_damage', at: '2026-03-18T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    expect(report.categoryTrendDirections).toEqual({ crop: 'increasing' });
  });

  it('names the report after its type and period', async () => {
    await seed(completeDataset());

    const report = await generateAnalytics(criteria({ reportType: 'patrolCoverage' }));
    expect(report.name).toBe('Patrol coverage report · 2026-03-01 to 2026-03-31');
  });

  it('writes an audit entry naming the generated report', async () => {
    await seed(completeDataset());

    const report = await generateAnalytics(criteria());
    const entry = await AuditEntry.findOne({ action: 'ANALYTICS_REPORT_GENERATED', detail: report.reportId }).lean();

    expect(entry).toBeTruthy();
    expect(entry.actor).toBe('demo-manager');
  });

  it('records the manager who requested the report when one is authenticated', async () => {
    await seed(completeDataset());
    const userId = new mongoose.Types.ObjectId();

    await generateAnalytics(criteria(), userId);

    const stored = await AnalyticsReport.findOne({ createdBy: userId }).lean();
    expect(stored).toBeTruthy();
  });

  it('assigns an incident to its nearest sector during aggregation', async () => {
    // Offset from the centre but still inside the 4 km radius.
    const inside = { location: { coordinates: [NORTH.center[0] + 0.005, NORTH.center[1]] } };
    expect(sectorForIncident(inside)).toBe('NORTHBOUNDARY');
  });

  it('reports only the selected zone in incident density', async () => {
    await seed({
      incidents: [
        conflictReport({ sector: NORTH, at: '2026-03-02T09:00:00Z' }),
        conflictReport({ sector: EAST, at: '2026-03-03T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria({ zones: [NORTH.code] }));

    // The density axes are zone-scoped, so EAST is absent rather than zero.
    expect(report.incidentDensity).toEqual({ NORTHBOUNDARY: 1 });
  });

  it('excludes incidents outside the selected period', async () => {
    await seed({
      incidents: [
        conflictReport({ at: '2026-03-15T09:00:00Z' }),
        conflictReport({ at: '2025-11-15T09:00:00Z' })
      ]
    });

    const report = await generateAnalytics(criteria());
    expect(report.summary.incidentCount).toBe(1);
  });

  it('includes an incident on the final day of the period', async () => {
    await seed({ incidents: [conflictReport({ at: '2026-03-31T23:00:00Z' })] });

    const report = await generateAnalytics(criteria());
    expect(report.summary.incidentCount).toBe(1);
  });

  it('excludes an incident one day past the final day', async () => {
    await seed({ incidents: [conflictReport({ at: '2026-04-01T00:00:00Z' })] });

    await expect(generateAnalytics(criteria())).rejects.toMatchObject({ statusCode: 422 });
  });

  it('reports coverage as null when no required hours are configured', async () => {
    delete process.env.REQUIRED_SECTOR_HOURS;
    delete process.env.REQUIRED_HOURS_NORTHBOUNDARY;
    await seed({ patrols: completeDataset().patrols });

    const report = await generateAnalytics(criteria());
    expect(report.patrolCoverage.NORTHBOUNDARY.requiredHours).toBe(0);
    expect(report.patrolCoverage.NORTHBOUNDARY.coveragePercent).toBeNull();
  });

  it('computes a coverage percentage against the configured requirement', async () => {
    process.env.REQUIRED_SECTOR_HOURS = JSON.stringify({ NORTHBOUNDARY: 20 });
    await seed({
      patrols: [patrolRecord({ sector: NORTH, startedAt: '2026-03-01T00:00:00Z', endedAt: '2026-03-02T00:00:00Z' })]
    });

    const report = await generateAnalytics(criteria());
    // 24 of the recorded hours counted against a 20-hour requirement, capped at 100.
    expect(report.patrolCoverage.NORTHBOUNDARY.coveragePercent).toBe(100);
    delete process.env.REQUIRED_SECTOR_HOURS;
  });
});