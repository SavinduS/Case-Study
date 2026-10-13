const request = require('supertest');
const app = require('../../app');
const ConflictReport = require('../../models/ConflictReport');
const PatrolRecord = require('../../models/PatrolRecord');
const ZoneSetting = require('../../models/ZoneSetting');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');

jest.setTimeout(60000);

// Member 2 — CSV/PDF export of a generated report (demo mode, no login).
const day = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * day);
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

let seq = 0;

async function generateSample() {
  const at = daysAgo(2);
  await ZoneSetting.create({ code: 'NORTHBOUNDARY', name: 'North Boundary', requiredHours: 8 });
  await ConflictReport.create({
    reportId: `CR-${Date.now()}-${(seq += 1)}`,
    incidentType: 'elephant_sighting',
    location: { type: 'Point', coordinates: [81.42, 6.62] },
    description: 'export test incident',
    createdAt: at
  });
  await PatrolRecord.create({
    sector: 'NORTHBOUNDARY',
    startedAt: new Date(at.getTime() - 4 * 3600000),
    endedAt: at
  });
  const res = await request(app).post('/api/analytics/generate').send({
    startDate: isoDay(daysAgo(10)),
    endDate: isoDay(new Date()),
    zones: ['NORTHBOUNDARY'],
    categories: [],
    reportType: 'patrolCoverage',
    baseline: null
  });
  expect(res.status).toBe(201);
  return res.body.reportId;
}

beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await resetTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

describe('GET /api/analytics/reports/:id/export', () => {
  test('exports readable CSV with zone breakdown', async () => {
    const reportId = await generateSample();
    const res = await request(app).get(`/api/analytics/reports/${reportId}/export?format=csv`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(reportId);
    expect(res.text).toMatch(/North Boundary/);
    expect(res.text).toMatch(/ZONE BREAKDOWN/);
  });

  test('exports a real PDF document, not an empty file', async () => {
    const reportId = await generateSample();
    const res = await request(app)
      .get(`/api/analytics/reports/${reportId}/export?format=pdf`)
      .buffer(true)
      .parse((r, done) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    const pdf = res.body;
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.slice(0, 5).toString()).toBe('%PDF-');
  });

  test('404s for an unknown report and 400s for a bad format', async () => {
    const missing = await request(app).get('/api/analytics/reports/AN-2099-999999/export?format=csv');
    expect(missing.status).toBe(404);

    const reportId = await generateSample();
    const bad = await request(app).get(`/api/analytics/reports/${reportId}/export?format=xlsx`);
    expect(bad.status).toBe(400);
  });
});
