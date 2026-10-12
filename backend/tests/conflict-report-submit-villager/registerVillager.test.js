// Public villager sign-up (POST /api/auth/register/villager) — the endpoint the
// mobile "Create an account" screen uses. Always creates a villager.
const request = require('supertest');
const app = require('../../app');
const User = require('../../models/User');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('../helpers/db');

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

async function login(identifier, password) {
  return request(app).post('/api/auth/login').send({ identifier, password });
}

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

  test('lowercases the email the same way the admin register does', async () => {
    const { res } = await signUp({ email: '  Soma.Silva@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('soma.silva@example.com');
    const stored = await User.findById(res.body.id).lean();
    expect(stored.email).toBe('soma.silva@example.com');
  });

  test('rejects a malformed email but still allows sign-up without one', async () => {
    const bad = await signUp({ email: 'not-an-address' });
    expect(bad.res.status).toBe(400);

    const none = await signUp();
    expect(none.res.status).toBe(201);
    expect(none.res.body.email).toBeUndefined();
  });

  test('sign-in right after sign-up returns phone and email in the session', async () => {
    const { res, phone } = await signUp({ email: 'soma@example.com' });
    expect(res.status).toBe(201);

    const loginRes = await login(phone, 'secret123');
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.phone).toBe(phone);
    expect(loginRes.body.email).toBe('soma@example.com');
    expect(loginRes.body.token).toEqual(expect.any(String));
  });
});
