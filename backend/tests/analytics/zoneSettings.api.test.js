const request = require('supertest');
const app = require('../../app');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');

jest.setTimeout(60000);

// Member 2 — patrol targets behind coverage %, stored in the database.
beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await resetTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

describe('GET /api/analytics/zone-settings', () => {
  test('returns all four zones with default targets before anything is saved', async () => {
    const res = await request(app).get('/api/analytics/zone-settings');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.find((z) => z.code === 'NORTHBOUNDARY')).toMatchObject({
      name: 'North Boundary',
      requiredHours: 8,
      saved: false
    });
  });
});

describe('PUT /api/analytics/zone-settings', () => {
  test('saves targets that the next report generation uses', async () => {
    const put = await request(app).put('/api/analytics/zone-settings').send({
      settings: [{ code: 'NORTHBOUNDARY', requiredHours: 12 }]
    });
    expect(put.status).toBe(200);
    expect(put.body).toEqual({ updated: 1 });

    const get = await request(app).get('/api/analytics/zone-settings');
    expect(get.body.find((z) => z.code === 'NORTHBOUNDARY')).toMatchObject({
      requiredHours: 12,
      saved: true
    });
  });

  test('rejects unknown zones, negative hours and empty payloads', async () => {
    const unknown = await request(app).put('/api/analytics/zone-settings').send({
      settings: [{ code: 'NOWHERE', requiredHours: 5 }]
    });
    expect(unknown.status).toBe(400);

    const negative = await request(app).put('/api/analytics/zone-settings').send({
      settings: [{ code: 'NORTHBOUNDARY', requiredHours: -5 }]
    });
    expect(negative.status).toBe(400);

    const empty = await request(app).put('/api/analytics/zone-settings').send({ settings: [] });
    expect(empty.status).toBe(400);
  });
});
