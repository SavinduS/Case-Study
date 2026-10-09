const request = require('supertest');
const app = require('../app');
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

function phone() {
  return `+947${Math.floor(Math.random() * 1e9)}`;
}

async function registerUser(overrides = {}) {
  return request(app).post('/api/auth/register').send({
    name: 'Test User',
    phone: phone(),
    password: 'secret123',
    role: 'villager',
    ...overrides
  });
}

const validReport = {
  incidentType: 'elephant_sighting',
  location: { coordinates: [81.42, 6.62] }
};

describe('POST /api/auth/register', () => {
  test('creates a user and returns a JWT', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.role).toBe('villager');
    expect(typeof res.body.token).toBe('string');
  });

  test('400 when name/phone/password missing', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(400);
  });

  test('400 when password is too short', async () => {
    const res = await registerUser({ password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/6 characters/);
  });

  test('400 when role is not allowed', async () => {
    const res = await registerUser({ role: 'president' });
    expect(res.status).toBe(400);
  });

  test('409 when the phone is already registered', async () => {
    const p = phone();
    await registerUser({ phone: p });
    const res = await registerUser({ phone: p });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('400 when fields missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ phone: phone() });
    expect(res.status).toBe(400);
  });

  test('401 for unknown phone', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: phone(), password: 'secret123' });
    expect(res.status).toBe(401);
  });

  test('401 for wrong password', async () => {
    await registerUser({ password: 'secret123' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: phone(), password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  test('200 with token for correct credentials', async () => {
    const p = phone();
    await registerUser({ phone: p, role: 'officer' });
    const res = await request(app).post('/api/auth/login').send({ phone: p, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('officer');
    expect(res.body.token).toBeDefined();
  });
});

describe('role guards on the admin feed', () => {
  async function officerToken() {
    const res = await registerUser({ role: 'officer' });
    return res.body.token;
  }

  test('403 without a token (role guard runs after optional auth)', async () => {
    const res = await request(app).get('/api/conflict-reports');
    expect(res.status).toBe(403);
  });

  test('401 with a garbage token', async () => {
    const res = await request(app)
      .get('/api/conflict-reports')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  test('403 with a villager token', async () => {
    const villager = await registerUser({ role: 'villager' });
    const res = await request(app)
      .get('/api/conflict-reports')
      .set('Authorization', `Bearer ${villager.body.token}`);
    expect(res.status).toBe(403);
  });

  test('200 with an officer token, newest first, officer-only fields present', async () => {
    const token = await officerToken();
    await request(app)
      .post('/api/conflict-reports')
      .send({ ...validReport, reporterContact: '+94771112222' });
    const res = await request(app)
      .get('/api/conflict-reports')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.reports[0].reporterContact).toBe('+94771112222');
    expect(res.body.reports[0].possibleDuplicateOf).toBeNull();
  });

  test('filters by incidentType and rejects a bad since', async () => {
    const token = await officerToken();
    await request(app).post('/api/conflict-reports').send(validReport);
    await request(app)
      .post('/api/conflict-reports')
      .send({ incidentType: 'crop_damage', location: { coordinates: [81.42, 6.62] } });

    const filtered = await request(app)
      .get('/api/conflict-reports?incidentType=crop_damage')
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.body.count).toBe(1);
    expect(filtered.body.reports[0].incidentType).toBe('crop_damage');

    const badSince = await request(app)
      .get('/api/conflict-reports?since=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(badSince.status).toBe(400);
  });

  test('GET /api/conflict-reports/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/conflict-reports/CR-2099-999999');
    expect(res.status).toBe(404);
  });
});

describe('incidents (ranger flow)', () => {
  test('POST without token is 401, invalid token is 401', async () => {
    expect((await request(app).post('/api/incidents').send({ notes: 'x' })).status).toBe(401);
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', 'Bearer bogus')
      .send({ notes: 'x' });
    expect(res.status).toBe(401);
  });

  test('POST with token creates an incident owned by the reporter; /mine lists only own', async () => {
    const a = await registerUser();
    const b = await registerUser();
    const incidentBody = {
      type: 'elephant',
      description: 'Elephant near the fence',
      location: { coordinates: [81.42, 6.62] }
    };

    const created = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${a.body.token}`)
      .send(incidentBody);
    expect(created.status).toBe(201);
    expect(created.body.reporter).toBeDefined();

    const mineA = await request(app)
      .get('/api/incidents/mine')
      .set('Authorization', `Bearer ${a.body.token}`);
    expect(mineA.status).toBe(200);
    expect(mineA.body.length).toBe(1);

    const mineB = await request(app)
      .get('/api/incidents/mine')
      .set('Authorization', `Bearer ${b.body.token}`);
    expect(mineB.body.length).toBe(0);
  });
});

describe('optionalAuth on report creation', () => {
  test('invalid bearer token is rejected even though auth is optional', async () => {
    const res = await request(app)
      .post('/api/conflict-reports')
      .set('Authorization', 'Bearer garbage')
      .send(validReport);
    expect(res.status).toBe(401);
  });
});
