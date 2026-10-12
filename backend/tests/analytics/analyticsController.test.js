import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const app = require('../../app');
const config = require('../../config');
const AnalyticsReport = require('../../models/AnalyticsReport');
const AuditEntry = require('../../models/AuditEntry');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');
const { NORTH, EAST, criteria, conflictReport, patrolRecord, completeDataset, seedConflicts } = require('./fixtures');

/**
 * Exercises the five REST endpoints the reports workspace calls. The routes
 * mount optionalAuth so a signed-in manager is filtered to their own reports,
 * and these cases cover both the anonymous demo mode and that ownership filter.
 */

const seed = async (docs) => {
  if (docs.incidents?.length) await seedConflicts(docs.incidents);
  if (docs.patrols?.length) await mongoose.model('PatrolRecord').insertMany(docs.patrols);
};

const asManager = (user) =>
  jwt.sign({ sub: String(user._id), role: 'manager' }, config.jwtSecret, { expiresIn: '1h' });

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

const validCriteria = (overrides = {}) => ({
  reportType: 'overview',
  zones: [NORTH.code],
  categories: [],
  startDate: '2026-03-01',
  endDate: '2026-03-31',
  ...overrides
});

describe('POST /api/analytics/generate', () => {
  it('creates a report and returns 201 with the persisted document', async () => {
    await seed(completeDataset());

    const res = await request(app).post('/api/analytics/generate').send(validCriteria());

    expect(res.status).toBe(201);
    expect(res.body.reportId).toMatch(/^AN-\d{4}-\d{6}$/);
    expect(res.body.status).toBe('complete');
    expect(res.body.incidentDensity).toBeTruthy();
  });

  it('rejects invalid criteria with 400 and names the problem', async () => {
    const res = await request(app).post('/api/analytics/generate').send({ startDate: '2026-03-01' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/startDate/);
  });

  it('rejects an unknown terrain zone with 400', async () => {
    await seed(completeDataset());
    const res = await request(app).post('/api/analytics/generate').send(validCriteria({ zones: ['NOWHERE'] }));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/zone/i);
  });

  it('returns 422 when the period holds no records at all', async () => {
    const res = await request(app).post('/api/analytics/generate').send(validCriteria());
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/No incident or patrol data/);
  });

  it('writes an audit entry recording that a report was generated', async () => {
    await seed(completeDataset());

    const res = await request(app).post('/api/analytics/generate').send(validCriteria());

    const entry = await AuditEntry.findOne({ detail: res.body.reportId }).lean();
    expect(entry).toBeTruthy();
    expect(entry.action).toBe('ANALYTICS_REPORT_GENERATED');
  });
});

describe('GET /api/analytics/reports', () => {
  it('returns an empty array before any report exists', async () => {
    const res = await request(app).get('/api/analytics/reports');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('lists generated reports newest first', async () => {
    await seed(completeDataset());

    const first = await request(app).post('/api/analytics/generate').send(validCriteria());
    const second = await request(app).post('/api/analytics/generate').send(validCriteria());

    const res = await request(app).get('/api/analytics/reports');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    // generatedAt is stamped on create, so the later report sorts first.
    expect(res.body[0].reportId).toBe(second.body.reportId);
    expect(res.body.some((r) => r.reportId === first.body.reportId)).toBe(true);
  });
});

describe('GET /api/analytics/reports/:id', () => {
  it('returns a stored report by its reference', async () => {
    await seed(completeDataset());
    const created = await request(app).post('/api/analytics/generate').send(validCriteria());

    const res = await request(app).get(`/api/analytics/reports/${created.body.reportId}`);

    expect(res.status).toBe(200);
    expect(res.body.reportId).toBe(created.body.reportId);
  });

  it('returns 404 for an unknown report reference', async () => {
    const res = await request(app).get('/api/analytics/reports/AN-0000-999999');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/not found/i);
  });
});

describe('GET /api/analytics/reports/:id/export', () => {
  const stored = async (overrides = {}) => {
    await seed(completeDataset());
    const created = await request(app).post('/api/analytics/generate').send(validCriteria());
    const doc = await AnalyticsReport.findOne({ reportId: created.body.reportId }).lean();
    if (overrides.reportId) return { ...doc, ...overrides };
    return doc;
  };

  it('exports a CSV attachment with a header row per section', async () => {
    const report = await stored();

    const res = await request(app).get(`/api/analytics/reports/${report.reportId}/export?format=csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('Report ID');
    expect(res.text).toContain('Coverage %');
    expect(res.text).toContain('Recommendations');
  });

  it('escapes embedded quotes and commas so the CSV stays parseable', async () => {
    const report = await stored();

    // Force recommendations containing both a quote and a comma through the
    // same document the export reads.
    await AnalyticsReport.updateOne(
      { reportId: report.reportId },
      { $set: { recommendations: ['He said "stop, now"', 'plain, text'] } }
    );

    const res = await request(app).get(`/api/analytics/reports/${report.reportId}/export?format=csv`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('""stop, now""');
    // Every value is wrapped in quotes, so a comma can never split a column.
    expect(res.text).toContain('"plain, text"');
  });

  it('exports a PDF attachment that starts with the PDF header', async () => {
    const report = await stored();

    const res = await request(app).get(`/api/analytics/reports/${report.reportId}/export?format=pdf`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    // The body is a hand-built minimal PDF, so it begins with the file marker.
    const body = res.body.toString();
    expect(body.startsWith('%PDF-1.4')).toBe(true);
    expect(body).toContain('%%EOF');
  });

  it('rejects an unsupported export format with 400', async () => {
    const report = await stored();
    const res = await request(app).get(`/api/analytics/reports/${report.reportId}/export?format=xlsx`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/csv or pdf/i);
  });

  it('rejects a missing export format with 400', async () => {
    const report = await stored();
    const res = await request(app).get(`/api/analytics/reports/${report.reportId}/export`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when exporting an unknown report', async () => {
    const res = await request(app).get('/api/analytics/reports/AN-0000-999999/export?format=csv');
    expect(res.status).toBe(404);
  });

  it('writes an audit entry recording the export', async () => {
    const report = await stored();

    await request(app).get(`/api/analytics/reports/${report.reportId}/export?format=csv`);

    const entry = await AuditEntry.findOne({ action: 'ANALYTICS_REPORT_EXPORTED' }).lean();
    expect(entry).toBeTruthy();
    expect(entry.detail).toContain(report.reportId);
    expect(entry.detail).toContain('csv');
  });
});

describe('GET /api/analytics/zones/:code/records', () => {
  it('returns the incidents and patrols recorded in a zone', async () => {
    await seed({
      incidents: [conflictReport({ sector: NORTH, at: '2026-03-05T09:00:00Z' })],
      patrols: [patrolRecord({ sector: NORTH, startedAt: '2026-03-05T00:00:00Z', endedAt: '2026-03-05T04:00:00Z' })]
    });

    const res = await request(app).get('/api/analytics/zones/NORTHBOUNDARY/records?startDate=2026-03-01&endDate=2026-03-31');

    expect(res.status).toBe(200);
    expect(res.body.incidents.length).toBeGreaterThanOrEqual(1);
    expect(res.body.patrols.length).toBeGreaterThanOrEqual(1);
  });

  it('excludes records that fall outside the requested date range', async () => {
    await seed({ incidents: [conflictReport({ at: '2026-03-05T09:00:00Z' }), conflictReport({ at: '2025-01-05T09:00:00Z' })] });

    const res = await request(app).get('/api/analytics/zones/NORTHBOUNDARY/records?startDate=2026-03-01&endDate=2026-03-31');

    expect(res.status).toBe(200);
    expect(res.body.incidents.length).toBe(1);
  });

  it('returns 400 for an unknown zone code', async () => {
    const res = await request(app).get('/api/analytics/zones/NOWHERE/records?startDate=2026-03-01&endDate=2026-03-31');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown terrain zone/);
  });

  it('returns 400 when the range end precedes the start', async () => {
    const res = await request(app).get('/api/analytics/zones/NORTHBOUNDARY/records?startDate=2026-03-31&endDate=2026-03-01');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid date range/);
  });

  it('returns 400 for an unparseable date', async () => {
    const res = await request(app).get('/api/analytics/zones/NORTHBOUNDARY/records?startDate=not-a-date');
    expect(res.status).toBe(400);
  });

  it('returns 422 when the zone has no records in the range', async () => {
    const res = await request(app).get('/api/analytics/zones/EASTBOUNDARY/records?startDate=2026-03-01&endDate=2026-03-31');
    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/No records found/);
  });
});

describe('ownership filtering', () => {
  const save = (reportId, createdBy) =>
    AnalyticsReport.create({
      reportId,
      createdBy,
      criteria: { reportType: 'overview', startDate: new Date('2026-03-01'), endDate: new Date('2026-03-31'), zones: [], categories: [] },
      status: 'complete'
    });

  it('shows a manager only the reports they generated', async () => {
    const manager = await mongoose.model('User').create({
      name: 'Manager One',
      phone: `+9470000000${Math.floor(Math.random() * 100000)}`,
      passwordHash: 'x',
      role: 'manager'
    });
    const other = await mongoose.model('User').create({
      name: 'Manager Two',
      phone: `+9471000000${Math.floor(Math.random() * 100000)}`,
      passwordHash: 'x',
      role: 'manager'
    });

    await save('AN-2026-000001', manager._id);
    await save('AN-2026-000002', other._id);

    const res = await request(app)
      .get('/api/analytics/reports')
      .set('Authorization', `Bearer ${asManager(manager)}`);

    expect(res.status).toBe(200);
    expect(res.body.map((r) => r.reportId)).toEqual(['AN-2026-000001']);
  });

  it('returns 404 when a manager requests another manager report', async () => {
    const manager = await mongoose.model('User').create({
      name: 'Manager Three',
      phone: `+9472000000${Math.floor(Math.random() * 100000)}`,
      passwordHash: 'x',
      role: 'manager'
    });
    const other = await mongoose.model('User').create({
      name: 'Manager Four',
      phone: `+9473000000${Math.floor(Math.random() * 100000)}`,
      passwordHash: 'x',
      role: 'manager'
    });
    await save('AN-2026-000009', other._id);

    const res = await request(app)
      .get('/api/analytics/reports/AN-2026-000009')
      .set('Authorization', `Bearer ${asManager(manager)}`);

    expect(res.status).toBe(404);
  });

  it('allows an authenticated manager to generate their own report', async () => {
    await seed(completeDataset());
    const manager = await mongoose.model('User').create({
      name: 'Manager Five',
      phone: `+9474000000${Math.floor(Math.random() * 100000)}`,
      passwordHash: 'x',
      role: 'manager'
    });

    const res = await request(app)
      .post('/api/analytics/generate')
      .set('Authorization', `Bearer ${asManager(manager)}`)
      .send(validCriteria());

    expect(res.status).toBe(201);
    expect(res.body.createdBy).toBe(String(manager._id));
  });

  it('refuses a non-manager role with 403', async () => {
    const token = jwt.sign({ sub: 'some-officer-id', role: 'officer' }, config.jwtSecret, { expiresIn: '1h' });

    const res = await request(app).get('/api/analytics/reports').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Forbidden/);
  });

  it('rejects a malformed token with 401', async () => {
    const res = await request(app).get('/api/analytics/reports').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });
});