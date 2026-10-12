const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
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

let phoneCounter = 0;

async function registerUser(overrides = {}) {
  phoneCounter += 1;
  const phone = `+9471${String(phoneCounter).padStart(8, '0')}`;
  const res = await request(app).post('/api/auth/register').send({
    name: 'Test User',
    phone,
    password: 'secret123',
    role: 'villager',
    ...overrides
  });
  expect(res.status).toBe(201);
  return { ...res.body, phone };
}

async function login(identifier, password) {
  return request(app).post('/api/auth/login').send({ identifier, password });
}

describe('POST /api/auth/login (mobile sign-in)', () => {
  test('returns the token, name and role the app routes on', async () => {
    const created = await registerUser({ name: 'Nimali', role: 'ranger' });

    const res = await login('+947100000001', 'secret123');

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.name).toBe('Nimali');
    expect(res.body.role).toBe('ranger');
    expect(res.body.id).toBe(created.id);
  });

  test('each role gets a session carrying its own role', async () => {
    for (const role of ['manager', 'officer', 'ranger', 'villager']) {
      phoneCounter += 1;
      const phone = `+9471${String(phoneCounter).padStart(8, '0')}`;
      await request(app)
        .post('/api/auth/register')
        .send({ name: `${role} user`, phone, password: 'secret123', role })
        .expect(201);

      const res = await login(phone, 'secret123');

      expect(res.status).toBe(200);
      expect(res.body.role).toBe(role);
    }
  });

  test('requires both an identifier and a password', async () => {
    await request(app).post('/api/auth/login').send({ password: 'secret123' }).expect(400);
    await request(app).post('/api/auth/login').send({ identifier: '+947100000099' }).expect(400);
  });

  test('rejects an unknown identifier and a wrong password the same way', async () => {
    const registered = await registerUser();
    const unknown = await login('+947199999999', 'secret123');
    const wrong = await login(registered.phone, 'wrong-password');

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe('Invalid credentials');
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  test('accepts either the email address or the phone number', async () => {
    const registered = await registerUser({
      email: 'nimali.perera@example.com',
      role: 'officer'
    });

    const byEmail = await login('nimali.perera@example.com', 'secret123');
    const byEmailMixedCase = await login('Nimali.Perera@Example.com', 'secret123');
    const byPhone = await login(registered.phone, 'secret123');

    for (const res of [byEmail, byEmailMixedCase, byPhone]) {
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(registered.id);
      expect(res.body.role).toBe('officer');
    }
  });

  test('still accepts the legacy `phone` field from older clients', async () => {
    const registered = await registerUser();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ phone: registered.phone, password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(registered.id);
  });

  test('an unknown email is rejected like any other bad identifier', async () => {
    const res = await login('nobody@example.com', 'secret123');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });
});

describe('POST /api/auth/register', () => {
  test('rejects an unknown role and a short password', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Imposter', phone: '+947100000002', password: 'secret123', role: 'admin' })
      .expect(400);

    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Short', phone: '+947100000003', password: 'abc', role: 'villager' })
      .expect(400);
  });

  test('refuses a second account on the same phone', async () => {
    const registered = await registerUser();

    const res = await request(app).post('/api/auth/register').send({
      name: 'Copycat',
      phone: registered.phone,
      password: 'secret123',
      role: 'villager'
    });

    expect(res.status).toBe(409);
  });

  test('stores the email in lower case and refuses a second use of it', async () => {
    const registered = await registerUser({ email: 'Ranger.One@Example.COM' });

    const stored = await User.findById(registered.id).lean();
    expect(stored.email).toBe('ranger.one@example.com');

    const duplicate = await request(app).post('/api/auth/register').send({
      name: 'Second User',
      phone: '+947100000999',
      email: 'ranger.one@example.com',
      password: 'secret123',
      role: 'villager'
    });
    expect(duplicate.status).toBe(409);

    // Different capitalisation is still the same address.
    const duplicateCased = await request(app).post('/api/auth/register').send({
      name: 'Third User',
      phone: '+947100000998',
      email: 'RANGER.ONE@EXAMPLE.COM',
      password: 'secret123',
      role: 'villager'
    });
    expect(duplicateCased.status).toBe(409);
  });

  test('rejects a malformed email but allows an account with none', async () => {
    const bad = await request(app).post('/api/auth/register').send({
      name: 'Typo',
      phone: '+947100000997',
      email: 'not-an-address',
      password: 'secret123',
      role: 'villager'
    });
    expect(bad.status).toBe(400);

    const withoutEmail = await request(app).post('/api/auth/register').send({
      name: 'No Email',
      phone: '+947100000996',
      password: 'secret123',
      role: 'villager'
    });
    expect(withoutEmail.status).toBe(201);
    expect((await User.findById(withoutEmail.body.id).lean()).email).toBeUndefined();
  });

  test('several accounts may have no email at all', async () => {
    // Sparse unique index: absent emails must not collide with each other.
    await registerUser();
    const second = await registerUser();

    expect(second.id).toEqual(expect.any(String));

    const loginRes = await login(second.phone, 'secret123');
    expect(loginRes.status).toBe(200);
  });
});

describe('GET /api/auth/me (session restore on app start)', () => {
  test('returns the current user for a valid token', async () => {
    const created = await registerUser({ name: 'Kamal', role: 'officer' });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${created.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: created.id, name: 'Kamal', role: 'officer', phone: created.phone });
  });

  test('rejects a missing or unusable token', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);
  });

  test('reports a deleted account as 401 so the phone signs out', async () => {
    const created = await registerUser();
    await User.deleteMany({});

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${created.token}`);

    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register/villager (public mobile sign-up)', () => {
  async function signUp(overrides = {}) {
    phoneCounter += 1;
    const phone = `+9471${String(phoneCounter).padStart(8, '0')}`;
    const res = await request(app).post('/api/auth/register/villager').send({
      name: 'Soma Silva',
      phone,
      password: 'secret123',
      ...overrides
    });
    return { res, phone };
  }

  test('creates a villager account and returns a usable session', async () => {
    const { res, phone } = await signUp({ email: 'soma@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Soma Silva');
    expect(res.body.phone).toBe(phone);
    expect(res.body.email).toBe('soma@example.com');
    expect(res.body.role).toBe('villager');
    expect(res.body.token).toEqual(expect.any(String));

    const stored = await User.findById(res.body.id).lean();
    expect(stored.role).toBe('villager');

    const loginRes = await login(phone, 'secret123');
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.role).toBe('villager');
  });

  test('ignores any role sent in the body — always a villager', async () => {
    const { res } = await signUp({ role: 'officer' });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe('villager');
    const stored = await User.findById(res.body.id).lean();
    expect(stored.role).toBe('villager');
  });

  test('refuses a duplicate phone number', async () => {
    const { phone } = await signUp();
    const second = await request(app).post('/api/auth/register/villager').send({
      name: 'Copycat',
      phone,
      password: 'secret123'
    });

    expect(second.status).toBe(409);
  });

  test('rejects a short password and missing fields', async () => {
    const short = await signUp({ password: 'abc' });
    expect(short.res.status).toBe(400);

    const missing = await request(app)
      .post('/api/auth/register/villager')
      .send({ name: 'No Phone' });
    expect(missing.status).toBe(400);
  });
});