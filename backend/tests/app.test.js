const request = require('supertest');
const app = require('../app');

describe('app wiring', () => {
  test('GET /health is 200 and never cached', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/definitely-not-a-route');
    expect(res.status).toBe(404);
  });

  test('malformed JSON body hits the error middleware (500 JSON)', async () => {
    const res = await request(app)
      .post('/api/conflict-reports')
      .set('Content-Type', 'application/json')
      .send('{ this is not json');
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server error');
  });
});
