const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const ConflictReport = require('../models/ConflictReport');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./helpers/db');

jest.setTimeout(60000);

const validReport = {
  incidentType: 'elephant_sighting',
  location: { coordinates: [81.42, 6.62] },
  description: 'Two elephants near the north fence',
  accuracyMeters: 4
};

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

async function registerUser(overrides = {}) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    phone: `+9477${Math.floor(Math.random() * 100000000)}`,
    password: 'secret123',
    role: 'villager',
    ...overrides
  });
  return res;
}

describe('POST /api/conflict-reports (FR-01, FR-08..FR-12)', () => {
  test('creates a report with CR- report id and RECEIVED status', async () => {
    const res = await request(app).post('/api/conflict-reports').send(validReport);
    expect(res.status).toBe(201);
    expect(res.body.reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(res.body.status).toBe('RECEIVED');
    expect(res.body.submissionMethod).toBe('app');
    expect(res.body.locationText).toBe('North Boundary');
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.duplicateOfReportId).toBeNull();
  });

  test('E1: missing required fields returns 400 with field errors', async () => {
    const res = await request(app).post('/api/conflict-reports').send({});
    expect(res.status).toBe(400);
    expect(res.body.errors.incidentType).toBeDefined();
    expect(res.body.errors.location).toBeDefined();
  });

  test('E2: location outside supported area returns 422', async () => {
    const res = await request(app)
      .post('/api/conflict-reports')
      .send({ ...validReport, location: { coordinates: [0, 0] } });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('OUTSIDE_SUPPORTED_AREA');
  });

  test('E4: possible duplicate is linked, never discarded', async () => {
    const first = await request(app).post('/api/conflict-reports').send(validReport);
    const second = await request(app)
      .post('/api/conflict-reports')
      .send({ ...validReport, description: 'Same elephants seen again' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.isPossibleDuplicate).toBe(true);
    expect(second.body.duplicateOfReportId).toBe(first.body.reportId);
    expect(await ConflictReport.countDocuments()).toBe(2);
  });

  test('token-optional: authenticated reporter is stored', async () => {
    const user = await registerUser();
    expect(user.status).toBe(201);
    const res = await request(app)
      .post('/api/conflict-reports')
      .set('Authorization', `Bearer ${user.body.token}`)
      .send(validReport);
    expect(res.status).toBe(201);
    const stored = await ConflictReport.findOne({ reportId: res.body.reportId });
    expect(String(stored.reporter)).toBe(user.body.id);
  });
});

describe('GET /api/conflict-reports/:reportId', () => {
  test('returns confirmation data and hides reporter contact', async () => {
    const created = await request(app)
      .post('/api/conflict-reports')
      .send({ ...validReport, reporterContact: '+94771234567' });
    const res = await request(app).get(`/api/conflict-reports/${created.body.reportId}`);
    expect(res.status).toBe(200);
    expect(res.body.reportId).toBe(created.body.reportId);
    expect(res.body.status).toBe('RECEIVED');
    expect(res.body.reporterContact).toBeUndefined();
  });

  test('404 for unknown report id', async () => {
    const res = await request(app).get('/api/conflict-reports/CR-2026-999999');
    expect(res.status).toBe(404);
  });
});

describe('auth (register/login)', () => {
  test('register returns token, login works, bad password rejected', async () => {
    const phone = `+9477${Math.floor(Math.random() * 100000000)}`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Villager', phone, password: 'secret123', role: 'villager' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();

    const ok = await request(app).post('/api/auth/login').send({ phone, password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();

    const bad = await request(app).post('/api/auth/login').send({ phone, password: 'wrongpass' });
    expect(bad.status).toBe(401);
  });

  test('duplicate phone registration returns 409', async () => {
    const phone = `+9477${Math.floor(Math.random() * 100000000)}`;
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', phone, password: 'secret123' });
    const dup = await request(app)
      .post('/api/auth/register')
      .send({ name: 'B', phone, password: 'secret123' });
    expect(dup.status).toBe(409);
  });
});

describe('GET /api/conflict-reports (FR-11 dashboard feed)', () => {
  test('rejects anonymous and villager, allows officer', async () => {
    await request(app).post('/api/conflict-reports').send(validReport);

    expect((await request(app).get('/api/conflict-reports')).status).toBe(403);

    const villager = await registerUser();
    expect(
      (await request(app)
        .get('/api/conflict-reports')
        .set('Authorization', `Bearer ${villager.body.token}`)).status
    ).toBe(403);

    const officer = await registerUser({ role: 'officer' });
    const list = await request(app)
      .get('/api/conflict-reports')
      .set('Authorization', `Bearer ${officer.body.token}`);
    expect(list.status).toBe(200);
    expect(list.body.count).toBe(1);
    expect(list.body.reports[0].reportId).toMatch(/^CR-\d{4}-\d{6}$/);
  });

  test('since filter limits the feed', async () => {
    await request(app).post('/api/conflict-reports').send(validReport);
    const officer = await registerUser({ role: 'officer' });
    const empty = await request(app)
      .get(`/api/conflict-reports?since=${new Date(Date.now() + 60000).toISOString()}`)
      .set('Authorization', `Bearer ${officer.body.token}`);
    expect(empty.body.count).toBe(0);
  });
});

describe('POST /api/conflict-reports/sync (FR-13, FR-14)', () => {
  test('bulk sync validates items and is idempotent per clientRefId', async () => {
    const payload = {
      reports: [
        { ...validReport, clientRefId: 'offline-1' },
        {
          incidentType: 'crop_damage',
          location: { coordinates: [81.52, 6.5] },
          clientRefId: 'offline-2'
        },
        { incidentType: 'crop_damage', clientRefId: 'offline-3' }, // no location
        { ...validReport, location: { coordinates: [0, 0] }, clientRefId: 'offline-4' } // outside area
      ]
    };

    const res = await request(app).post('/api/conflict-reports/sync').send(payload);
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(2);
    expect(res.body.results[0].ok).toBe(true);
    expect(res.body.results[0].reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(res.body.results[2].ok).toBe(false);
    expect(res.body.results[2].errors.location).toBeDefined();
    expect(res.body.results[2].message).toBe('Validation failed');
    expect(res.body.results[3].ok).toBe(false);
    expect(res.body.results[3].message).toMatch(/outside/i);

    const retry = await request(app)
      .post('/api/conflict-reports/sync')
      .send({ reports: [payload.reports[0]] });
    expect(retry.body.synced).toBe(1);
    expect(retry.body.results[0].alreadySynced).toBe(true);
    expect(retry.body.results[0].reportId).toBe(res.body.results[0].reportId);
    expect(await ConflictReport.countDocuments()).toBe(2);
  });

  test('rejects non-array payloads and missing clientRefId', async () => {
    expect((await request(app).post('/api/conflict-reports/sync').send({})).status).toBe(400);
    const res = await request(app)
      .post('/api/conflict-reports/sync')
      .send({ reports: [{ ...validReport }] });
    expect(res.body.results[0].ok).toBe(false);
    expect(res.body.results[0].errors.clientRefId).toBeDefined();
    expect(res.body.results[0].message).toBe('clientRefId is required for sync');
  });
});

describe('POST /api/conflict-reports/inbound-sms (FR-02)', () => {
  test('complete SMS creates an SMS-submitted report and replies with the ID', async () => {
    const res = await request(app)
      .post('/api/conflict-reports/inbound-sms')
      .send({ from: '+94771112222', text: '1 NORTHBOUNDARY' });
    expect(res.status).toBe(200);
    expect(res.body.reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(res.body.reply).toContain(res.body.reportId);

    const lookup = await request(app).get(`/api/conflict-reports/${res.body.reportId}`);
    expect(lookup.body.submissionMethod).toBe('sms');
    expect(lookup.body.incidentType).toBe('elephant_sighting');
    expect(lookup.body.locationText).toBe('North Boundary');
  });

  test('unparseable SMS goes to review queue with a menu reply (E-flow)', async () => {
    const res = await request(app)
      .post('/api/conflict-reports/inbound-sms')
      .send({ from: '+94771113333', text: 'SOUTHBOUNDARY' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain('Reply 1-Elephant');
    expect(res.body.reportId).toBeUndefined();
    expect(await ConflictReport.countDocuments()).toBe(0);
  });

  test('menu recovery: area-only, then type-only, then digit reply completes', async () => {
    const first = await request(app)
      .post('/api/conflict-reports/inbound-sms')
      .send({ from: '+94771114444', text: 'CROP' });
    expect(first.body.reply).toContain('Reply with your area');

    const second = await request(app)
      .post('/api/conflict-reports/inbound-sms')
      .send({ from: '+94771114444', text: 'NORTHBOUNDARY' });
    expect(second.body.reply).toContain('Reply 1-Elephant');

    const third = await request(app)
      .post('/api/conflict-reports/inbound-sms')
      .send({ from: '+94771114444', text: '2' });
    expect(third.body.reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(third.body.reply).toContain('Report received');

    const stored = await ConflictReport.findOne({ reportId: third.body.reportId });
    expect(stored.incidentType).toBe('crop_damage');
    expect(stored.submissionMethod).toBe('sms');
    expect(stored.reporterContact).toBe('+94771114444');
  });

  test('missing from/text returns 400', async () => {
    expect((await request(app).post('/api/conflict-reports/inbound-sms').send({})).status).toBe(400);
  });
});

describe('POST /api/conflict-reports/photo (FR-07, E5)', () => {
  test('accepts a JPEG and returns a photo URL', async () => {
    const res = await request(app)
      .post('/api/conflict-reports/photo')
      .attach('photo', Buffer.from('fakejpeg'), {
        filename: 'elephant.jpg',
        contentType: 'image/jpeg'
      });
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toMatch(/^\/uploads\/photo-.*\.jpg$/);
    const file = path.join(__dirname, '..', 'uploads', path.basename(res.body.photoUrl));
    if (fs.existsSync(file)) fs.unlinkSync(file);
  });

  test('rejects unsupported file types (E5)', async () => {
    const res = await request(app)
      .post('/api/conflict-reports/photo')
      .attach('photo', Buffer.from('notanimage'), {
        filename: 'report.pdf',
        contentType: 'application/pdf'
      });
    expect(res.status).toBe(415);
  });
});
