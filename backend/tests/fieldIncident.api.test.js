const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../app');
const FieldIncident = require('../models/FieldIncident');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./helpers/db');

jest.setTimeout(60000);

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

let uuidCounter = 0;
function uuid() {
  uuidCounter += 1;
  const hex = uuidCounter.toString(16).padStart(12, '0');
  return `123e4567-e89b-12d3-a456-${hex}`;
}

function validBody(overrides = {}) {
  return {
    reportId: uuid(),
    incidentType: 'snare_illegal_hunting',
    description: 'Illegal wire snare found near the game trail.',
    latitude: -1.292345,
    longitude: 36.821456,
    locationSource: 'gps',
    accuracy: 8,
    capturedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    ...overrides
  };
}

async function registerRanger(overrides = {}) {
  const res = await request(app).post('/api/auth/register').send({
    name: 'Ranger',
    phone: `+9477${Math.floor(Math.random() * 100000000)}`,
    password: 'secret123',
    role: 'ranger',
    ...overrides
  });
  expect(res.status).toBe(201);
  return res.body;
}

function cleanupUpload(photo) {
  if (!photo || !photo.path) return;
  const file = path.join(__dirname, '..', path.basename(photo.path));
  const uploadsFile = path.join(__dirname, '..', 'uploads', path.basename(photo.path));
  for (const candidate of [uploadsFile, file]) {
    try {
      if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    } catch {
      // ignore cleanup errors
    }
  }
}

describe('POST /api/field-incidents', () => {
  test('creates a report without a photo, assigns displayId/reporter/receivedAt', async () => {
    const ranger = await registerRanger();
    const body = validBody();

    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(body);

    expect(res.status).toBe(201);
    expect(res.body.reportId).toBe(body.reportId);
    expect(res.body.displayId).toMatch(/^FI-\d{4}-\d{4}$/);
    expect(res.body.incidentType).toBe('snare_illegal_hunting');
    expect(res.body.location.coordinates).toEqual([36.821456, -1.292345]);
    expect(res.body.photo).toBeNull();
    expect(new Date(res.body.receivedAt).getTime()).not.toBeNaN();

    const stored = await FieldIncident.findOne({ reportId: body.reportId });
    expect(String(stored.reporter)).toBe(ranger.id);
    expect(stored.displayId).toBe(res.body.displayId);
    expect(stored.receivedAt).toBeInstanceOf(Date);
  });

  test('accepts each canonical incident type', async () => {
    const ranger = await registerRanger();
    for (const incidentType of [
      'snare_illegal_hunting',
      'animal_carcass',
      'footprints',
      'illegal_campsite'
    ]) {
      const res = await request(app)
        .post('/api/field-incidents')
        .set('Authorization', `Bearer ${ranger.token}`)
        .send(validBody({ incidentType }));
      expect(res.status).toBe(201);
      expect(res.body.incidentType).toBe(incidentType);
    }
  });

  test('creates a report with an attached JPEG photo (multipart)', async () => {
    const ranger = await registerRanger();
    const body = validBody();

    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .field('reportId', body.reportId)
      .field('incidentType', body.incidentType)
      .field('description', body.description)
      .field('latitude', String(body.latitude))
      .field('longitude', String(body.longitude))
      .field('capturedAt', body.capturedAt)
      .attach('photo', Buffer.from('fakejpeg'), {
        filename: 'snare.jpg',
        contentType: 'image/jpeg'
      });

    expect(res.status).toBe(201);
    expect(res.body.photo).toMatchObject({ mimeType: 'image/jpeg' });
    expect(res.body.photo.path).toMatch(/^\/uploads\//);
    cleanupUpload(res.body.photo);
  });

  test('validation errors return 400 with { errors: [{ field, message }] }', async () => {
    const ranger = await registerRanger();
    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send({ reportId: uuid(), description: '   ' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
    expect(Array.isArray(res.body.errors)).toBe(true);
    const byField = Object.fromEntries(res.body.errors.map((e) => [e.field, e.message]));
    expect(byField.incidentType).toBe('Unknown incident type');
    expect(byField.description).toBeDefined();
    expect(byField.location).toBeDefined();
    expect(byField.capturedAt).toBeDefined();
  });

  test('missing authentication returns 401 and stores nothing', async () => {
    const res = await request(app).post('/api/field-incidents').send(validBody());
    expect(res.status).toBe(401);
    expect(await FieldIncident.countDocuments()).toBe(0);

    const bad = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', 'Bearer not-a-token')
      .send(validBody());
    expect(bad.status).toBe(401);
  });

  test('duplicate reportId never creates a second record (idempotency)', async () => {
    const ranger = await registerRanger();
    const reportId = uuid();
    const first = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(validBody({ reportId }));
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(validBody({ reportId, description: 'Changed description' }));
    expect(second.status).toBe(200);
    expect(second.body.reportId).toBe(reportId);
    expect(second.body.displayId).toBe(first.body.displayId);
    expect(second.body.alreadySynced).toBe(true);
    expect(await FieldIncident.countDocuments()).toBe(1);
  });

  test('photo larger than 5 MB returns 413', async () => {
    const ranger = await registerRanger();
    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(
        validBody({
          photo: { path: '/uploads/big.jpg', mimeType: 'image/jpeg', size: 5 * 1024 * 1024 + 1 }
        })
      );
    expect(res.status).toBe(413);
    expect(res.body.errors.find((e) => e.field === 'photo')).toBeDefined();
  });

  test('unsupported photo type returns 415', async () => {
    const ranger = await registerRanger();
    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(
        validBody({
          photo: { path: '/uploads/x.pdf', mimeType: 'application/pdf', size: 1024 }
        })
      );
    expect(res.status).toBe(415);
  });

  test('multipart upload exceeding 5 MB returns 413', async () => {
    const ranger = await registerRanger();
    const body = validBody();
    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .field('reportId', body.reportId)
      .field('incidentType', body.incidentType)
      .field('description', body.description)
      .field('latitude', String(body.latitude))
      .field('longitude', String(body.longitude))
      .field('capturedAt', body.capturedAt)
      .attach('photo', Buffer.alloc(5 * 1024 * 1024 + 1, 'a'), {
        filename: 'big.jpg',
        contentType: 'image/jpeg'
      });
    expect(res.status).toBe(413);
  });

  test('multipart upload with unsupported type returns 415', async () => {
    const ranger = await registerRanger();
    const body = validBody();
    const res = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .field('reportId', body.reportId)
      .field('incidentType', body.incidentType)
      .field('description', body.description)
      .field('latitude', String(body.latitude))
      .field('longitude', String(body.longitude))
      .field('capturedAt', body.capturedAt)
      .attach('photo', Buffer.from('notanimage'), {
        filename: 'note.pdf',
        contentType: 'application/pdf'
      });
    expect(res.status).toBe(415);
  });
});

describe('POST /api/field-incidents/sync', () => {
  test('bulk partial success keeps successes and reports failures', async () => {
    const ranger = await registerRanger();
    const good1 = validBody({ incidentType: 'footprints' });
    const good2 = validBody({ incidentType: 'animal_carcass' });
    const bad = { reportId: uuid(), incidentType: 'nope' };

    const res = await request(app)
      .post('/api/field-incidents/sync')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send({ reports: [good1, bad, good2] });

    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(2);
    expect(res.body.results).toHaveLength(3);
    expect(res.body.results[0].ok).toBe(true);
    expect(res.body.results[0].displayId).toMatch(/^FI-/);
    expect(res.body.results[1].ok).toBe(false);
    expect(res.body.results[2].ok).toBe(true);
    expect(await FieldIncident.countDocuments()).toBe(2);
  });

  test('bulk sync is idempotent per reportId', async () => {
    const ranger = await registerRanger();
    const item = validBody();
    const first = await request(app)
      .post('/api/field-incidents/sync')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send({ reports: [item] });
    const retry = await request(app)
      .post('/api/field-incidents/sync')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send({ reports: [item] });

    expect(first.body.synced).toBe(1);
    expect(retry.body.synced).toBe(1);
    expect(retry.body.results[0].alreadySynced).toBe(true);
    expect(retry.body.results[0].displayId).toBe(first.body.results[0].displayId);
    expect(await FieldIncident.countDocuments()).toBe(1);
  });

  test('bulk sync rejects non-array payloads and flags missing reportId', async () => {
    const ranger = await registerRanger();
    expect(
      (
        await request(app)
          .post('/api/field-incidents/sync')
          .set('Authorization', `Bearer ${ranger.token}`)
          .send({})
      ).status
    ).toBe(400);

    const res = await request(app)
      .post('/api/field-incidents/sync')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send({ reports: [{ incidentType: 'footprints' }] });
    expect(res.body.results[0].ok).toBe(false);
    expect(res.body.results[0].errors[0].field).toBe('reportId');
  });

  test('bulk sync requires authentication', async () => {
    const res = await request(app).post('/api/field-incidents/sync').send({ reports: [] });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/field-incidents/mine and /:reportId', () => {
  test('mine returns only the caller’s reports, newest first', async () => {
    const ranger = await registerRanger();
    const other = await registerRanger();
    await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(validBody());
    await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${other.token}`)
      .send(validBody());

    const res = await request(app)
      .get('/api/field-incidents/mine')
      .set('Authorization', `Bearer ${ranger.token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.reports).toHaveLength(1);
  });

  test('mine requires authentication', async () => {
    expect((await request(app).get('/api/field-incidents/mine')).status).toBe(401);
  });

  test('get by reportId returns the report, 404 when unknown', async () => {
    const ranger = await registerRanger();
    const created = await request(app)
      .post('/api/field-incidents')
      .set('Authorization', `Bearer ${ranger.token}`)
      .send(validBody());
    const found = await request(app)
      .get(`/api/field-incidents/${created.body.reportId}`)
      .set('Authorization', `Bearer ${ranger.token}`);
    expect(found.status).toBe(200);
    expect(found.body.reportId).toBe(created.body.reportId);
    expect(found.body.displayId).toBe(created.body.displayId);

    const missing = await request(app)
      .get('/api/field-incidents/123e4567-e89b-12d3-a456-426614179999')
      .set('Authorization', `Bearer ${ranger.token}`);
    expect(missing.status).toBe(404);
  });

  test('get by reportId requires authentication', async () => {
    expect((await request(app).get('/api/field-incidents/whatever')).status).toBe(401);
  });
});
