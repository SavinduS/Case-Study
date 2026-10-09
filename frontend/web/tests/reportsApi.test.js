import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getReport, getSavedReports, getZoneRecords, saveReport, exportReport, reportsRequest } from '../src/features/reports/services/reportsApi.js';

/**
 * The reports feature decides nothing on the client beyond shaping the
 * response: every number below is either read from the payload the server
 * returned or derived from it by normalizeReport. These cases pin that
 * translation so the KPI cards, risk badges and coverage bars always agree with
 * the database.
 */

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(body))
});

const baseReport = {
  reportId: 'AN-2026-000001',
  summary: { incidentCount: 4, patrolCount: 2, periodDays: 31 },
  incidentDensity: { NORTHBOUNDARY: 2 },
  patrolCoverage: { NORTHBOUNDARY: { requiredHours: 10, actualHours: 5, coveragePercent: 50 } },
  weeklyTrends: { '2026-W10': 1, '2026-W11': 3 },
  categoryTrends: { elephant: { '2026-W10': 1, '2026-W11': 2 }, crop: { '2026-W10': 1 } }
};

const baseCriteria = {
  reportType: 'incident',
  zones: ['NORTHBOUNDARY'],
  categories: ['elephant', 'crop'],
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  baseline: 'previous-period'
};

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse(baseReport)));
  global.fetch = fetchMock;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getReport request shaping', () => {
  it('posts the criteria to the analytics generate endpoint', async () => {
    await getReport(baseCriteria);

    expect(fetchMock).toHaveBeenCalledWith('/api/analytics/generate', expect.objectContaining({ method: 'POST' }));
  });

  it('maps the UI report type onto the API report type', async () => {
    await getReport({ ...baseCriteria, reportType: 'incident' });
    let body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.reportType).toBe('incidentSummary');

    await getReport({ ...baseCriteria, reportType: 'patrol' });
    body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.reportType).toBe('patrolCoverage');

    await getReport({ ...baseCriteria, reportType: 'terrain' });
    body = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(body.reportType).toBe('terrainTrend');
  });

  it('sends a null baseline when the manager chose no comparison', async () => {
    await getReport({ ...baseCriteria, baseline: 'none' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    // The API rejects an explicit "none" string; null is how the choice is
    // expressed on the wire.
    expect(body.baseline).toBeNull();
  });

  it('keeps a real baseline value in the request', async () => {
    await getReport({ ...baseCriteria, baseline: 'previous-year' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.baseline).toBe('previous-year');
  });

  it('reports the UI report type on the normalised result', async () => {
    const report = await getReport({ ...baseCriteria, reportType: 'terrain' });
    expect(report.reportType).toBe('terrain');
  });
});

describe('normalizeReport KPI derivation', () => {
  it('reads the incident count from the server summary', async () => {
    const report = await getReport(baseCriteria);
    expect(report.kpis.incidents).toBe(4);
  });

  it('computes patrol coverage as a percentage of required hours', async () => {
    // 5 actual against 10 required across the selected zones.
    const report = await getReport(baseCriteria);
    expect(report.kpis.patrolCoverage).toBe(50);
  });

  it('reports zero coverage when nothing was required', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...baseReport,
        patrolCoverage: { NORTHBOUNDARY: { requiredHours: 0, actualHours: 5, coveragePercent: null } }
      })
    );

    const report = await getReport(baseCriteria);
    // A zero denominator cannot produce a percentage.
    expect(report.kpis.patrolCoverage).toBe(0);
  });

  it('leaves response time unavailable rather than inventing a figure', async () => {
    const report = await getReport(baseCriteria);
    expect(report.kpis.responseTime).toBeNull();
  });

  it('counts the zones the server flagged as high risk', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...baseReport,
        incidentDensity: { NORTHBOUNDARY: 12, EASTBOUNDARY: 6, SOUTHBOUNDARY: 1 },
        patrolCoverage: {
          NORTHBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 },
          EASTBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 },
          SOUTHBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 }
        }
      })
    );

    const report = await getReport(baseCriteria);
    // Only the busiest zone crosses the incident threshold; EAST sits in the
    // Medium band and SOUTH in Low.
    expect(report.kpis.hotspots).toBe(1);
  });
});

describe('normalizeReport zone risk banding', () => {
  const zoneReport = (density, coverage) =>
    jsonResponse({
      ...baseReport,
      incidentDensity: density,
      patrolCoverage: coverage
    });

  it('marks a zone High on incident volume alone', async () => {
    fetchMock.mockResolvedValueOnce(
      zoneReport({ NORTHBOUNDARY: 10 }, { NORTHBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 } })
    );

    const report = await getReport(baseCriteria);
    expect(report.zones[0].risk).toBe('High');
  });

  it('marks a zone High on poor coverage alone', async () => {
    fetchMock.mockResolvedValueOnce(
      zoneReport({ NORTHBOUNDARY: 1 }, { NORTHBOUNDARY: { requiredHours: 10, actualHours: 4, coveragePercent: 40 } })
    );

    const report = await getReport(baseCriteria);
    expect(report.zones[0].risk).toBe('High');
  });

  it('marks a zone Medium on moderate volume', async () => {
    fetchMock.mockResolvedValueOnce(
      zoneReport({ NORTHBOUNDARY: 6 }, { NORTHBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 } })
    );

    const report = await getReport(baseCriteria);
    expect(report.zones[0].risk).toBe('Medium');
  });

  it('marks a quiet, well-patrolled zone Low', async () => {
    fetchMock.mockResolvedValueOnce(
      zoneReport({ NORTHBOUNDARY: 1 }, { NORTHBOUNDARY: { requiredHours: 10, actualHours: 10, coveragePercent: 100 } })
    );

    const report = await getReport(baseCriteria);
    expect(report.zones[0].risk).toBe('Low');
  });

  it('labels a zone it does not recognise with its raw code', async () => {
    fetchMock.mockResolvedValueOnce(
      zoneReport({ CENTRALRESERVE: 1 }, { CENTRALRESERVE: { requiredHours: 10, actualHours: 10, coveragePercent: 100 } })
    );

    const report = await getReport(baseCriteria);
    expect(report.zones[0].name).toBe('CENTRALRESERVE');
  });
});

describe('normalizeReport field fallbacks', () => {
  it('defaults the status to complete when the server omits it', async () => {
    const report = await getReport(baseCriteria);
    expect(report.status).toBe('complete');
  });

  it('keeps a partial status with its reasons', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ...baseReport, status: 'partial', partialReasons: ['Patrol records are incomplete'] })
    );

    const report = await getReport(baseCriteria);
    expect(report.status).toBe('partial');
    expect(report.partialReasons).toEqual(['Patrol records are incomplete']);
  });

  it('defaults missing lists to empty rather than undefined', async () => {
    const report = await getReport(baseCriteria);
    expect(report.recommendations).toEqual([]);
    expect(report.comparison).toEqual({});
  });

  it('falls back to baselineComparison when comparison is absent', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...baseReport, baselineComparison: { incidentCount: { current: 3 } } }));
    const report = await getReport(baseCriteria);
    expect(report.comparison.incidentCount.current).toBe(3);
  });

  it('sums the category trends into a distribution', async () => {
    const report = await getReport(baseCriteria);
    const distribution = Object.fromEntries(report.categoryDistribution.map((c) => [c.label, c.value]));
    expect(distribution.elephant).toBe(3);
    expect(distribution.crop).toBe(1);
  });

  it('prefers a category distribution the server already supplied', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...baseReport, categoryDistribution: [{ label: 'elephant', value: 9 }] }));
    const report = await getReport(baseCriteria);
    expect(report.categoryDistribution).toEqual([{ label: 'elephant', value: 9 }]);
  });

  it('carries the server trend direction through when present', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...baseReport, trendDirection: 'decreasing' }));
    const report = await getReport(baseCriteria);
    expect(report.trendDirection).toBe('decreasing');
  });

  it('turns weekly trends into an ordered label/value series', async () => {
    const report = await getReport(baseCriteria);
    expect(report.trend).toEqual([
      { label: '2026-W10', value: 1 },
      { label: '2026-W11', value: 3 }
    ]);
  });
});

describe('error handling', () => {
  it('raises a zero-status error when the API cannot be reached', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('network down')));

    await expect(getReport(baseCriteria)).rejects.toMatchObject({ status: 0 });
  });

  it('surfaces the server message from a failed request', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 400,
      text: () => Promise.resolve(JSON.stringify({ message: 'zones must contain configured sector codes' }))
    }));

    await expect(getReport(baseCriteria)).rejects.toMatchObject({
      status: 400,
      message: 'zones must contain configured sector codes'
    });
  });

  it('falls back to a status message when the error body is not JSON', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html>Bad Gateway</html>')
    }));

    await expect(getReport(baseCriteria)).rejects.toMatchObject({ status: 502 });
  });
});

describe('other workspace endpoints', () => {
  it('lists saved reports', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ reportId: 'AN-2026-000001' }]));
    const saved = await getSavedReports();
    expect(saved).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analytics/reports');
  });

  it('requests zone drill-down records for a code and date range', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ incidents: [], patrols: [] }));

    await getZoneRecords('NORTHBOUNDARY', '2026-03-01', '2026-03-31');

    expect(fetchMock.mock.calls[0][0]).toContain('/api/analytics/zones/NORTHBOUNDARY/records');
    expect(fetchMock.mock.calls[0][0]).toContain('startDate=2026-03-01');
    expect(fetchMock.mock.calls[0][0]).toContain('endDate=2026-03-31');
  });

  it('encodes a zone code that needs escaping', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ incidents: [], patrols: [] }));
    await getZoneRecords('NORTH BOUNDARY', '2026-03-01', '2026-03-31');
    expect(fetchMock.mock.calls[0][0]).toContain('NORTH%20BOUNDARY');
  });

  it('treats save as a generate so the API persists the report', async () => {
    await saveReport(baseCriteria);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analytics/generate');
  });

  it('downloads an exported report as a blob', async () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['Report ID'], { type: 'text/csv' }))
    }));

    await exportReport('AN-2026-000001', 'csv');

    expect(global.fetch.mock.calls[0][0]).toContain('/api/analytics/reports/AN-2026-000001/export?format=csv');
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('raises a zero-status error when the export cannot be reached', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('offline')));

    await expect(exportReport('AN-2026-000001', 'pdf')).rejects.toMatchObject({ status: 0 });
  });

  it('surfaces the server reason when an export is refused', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Analytics report not found' })
    }));

    await expect(exportReport('AN-2026-999999', 'csv')).rejects.toMatchObject({
      status: 404,
      message: 'Analytics report not found'
    });
  });

  it('exposes the raw request helper for the pages that need it', async () => {
    await reportsRequest('/analytics/reports/AN-2026-000001');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/analytics/reports/AN-2026-000001');
  });
});