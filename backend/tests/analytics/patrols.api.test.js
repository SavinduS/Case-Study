const request = require('supertest');
const app = require('../../app');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');

jest.setTimeout(60000);

// Member 2 — patrol records feeding the coverage % (ranger/manager/demo).
beforeAll(async () => { await connectTestDb(); });
afterEach(async () => { await resetTestDb(); });
afterAll(async () => { await disconnectTestDb(); });

describe('POST /api/patrols', () => {
  test('logs a patrol and derives hours from start/end', async () => {
    const res = await request(app).post('/api/patrols').send({
      sector: 'north boundary',
      startedAt: '2026-10-08T08:00:00Z',
      endedAt: '2026-10-08T12:00:00Z',
      notes: 'North fence line'
    });

    expect(res.status).toBe(201);
    expect(res.body.sector).toBe('NORTHBOUNDARY');
    expect(res.body.hours).toBe(4);
  });

  test('accepts a patrol date with duration instead of timestamps', async () => {
    const res = await request(app).post('/api/patrols').send({
      sector: 'EASTBOUNDARY',
      patrolDate: '2026-10-09T08:00:00Z',
      durationHours: 6
    });

    expect(res.status).toBe(201);
    expect(res.body.hours).toBe(6);
  });

  test('rejects unknown zones, reversed dates and missing dates', async () => {
    const unknown = await request(app).post('/api/patrols').send({
      sector: 'NOWHERE',
      startedAt: '2026-10-08T08:00:00Z',
      endedAt: '2026-10-08T12:00:00Z'
    });
    expect(unknown.status).toBe(400);

    const reversed = await request(app).post('/api/patrols').send({
      sector: 'NORTHBOUNDARY',
      startedAt: '2026-10-08T12:00:00Z',
      endedAt: '2026-10-08T08:00:00Z'
    });
    expect(reversed.status).toBe(400);

    const dateless = await request(app).post('/api/patrols').send({ sector: 'NORTHBOUNDARY' });
    expect(dateless.status).toBe(400);
  });
});
