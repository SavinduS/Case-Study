const request = require('supertest');
const app = require('../app');
const SmsReviewQueue = require('../models/SmsReviewQueue');
const ConflictReport = require('../models/ConflictReport');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./helpers/db');

jest.setTimeout(60000);

const FROM = '+94775550001';

beforeAll(async () => {
  await connectTestDb();
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

function sms(text, from = FROM) {
  return request(app).post('/api/conflict-reports/inbound-sms').send({ from, text });
}

describe('SMS recovery conversation (inbound-sms branches)', () => {
  test('keyword text with a type but no area is queued and answered with the area help', async () => {
    const res = await sms('help me the elephants are here');
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/Reply with your area/);
    expect(await SmsReviewQueue.countDocuments({ phone: FROM })).toBe(1);
    const queued = await SmsReviewQueue.findOne({ phone: FROM });
    expect(queued.parsedIncidentType).toBe('elephant_sighting');
    expect(await ConflictReport.countDocuments({ smsFrom: FROM })).toBe(0);
  });

  test('fully unparseable text gets the type menu plus the example format', async () => {
    const res = await sms('urgent please assist', '+94775550005');
    expect(res.body.reply).toMatch(/Reply 1-Elephant/);
    expect(res.body.reply).toMatch(/1 NORTHBOUNDARY/);
    const queued = await SmsReviewQueue.findOne({ phone: '+94775550005' });
    expect(queued.rawText).toBe('urgent please assist');
  });

  test('type-only menu reply with no queued context gets the format hint', async () => {
    const res = await sms('3', '+94775559999');
    expect(res.body.reply).toMatch(/Followed by your area/);
  });

  test('type-only SMS without area is queued and answered with the area help', async () => {
    const res = await sms('CROP DAMAGE', '+94775550002');
    expect(res.body.reply).toMatch(/Reply with your area/);
    const queued = await SmsReviewQueue.findOne({ phone: '+94775550002' });
    expect(queued.parsedIncidentType).toBe('crop_damage');
  });

  test('area-only SMS without type is queued and answered with the type menu', async () => {
    const res = await sms('EASTBOUNDARY', '+94775550003');
    expect(res.body.reply).toMatch(/Reply 1-Elephant/);
    const queued = await SmsReviewQueue.findOne({ phone: '+94775550003' });
    expect(queued.parsedAreaCode).toBe('EASTBOUNDARY');
  });

  test('full recovery: menu_reply fills the type, later area reply completes the report', async () => {
    // 1. garbage -> type menu
    await sms('urgent help');
    // 2. villager answers the menu -> area help (type stored on the queue)
    const afterType = await sms('2');
    expect(afterType.body.reply).toMatch(/Reply with your area/);
    // 3. villager sends the area -> type menu again (area stored on a new queue row)
    const afterArea = await sms('WESTBOUNDARY');
    expect(afterArea.body.reply).toMatch(/Reply 1-Elephant/);
    // 4. villager confirms the type -> report created from the queued pieces
    const done = await sms('2');
    expect(done.body.reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(done.body.reply).toMatch(/Report received/);

    const stored = await ConflictReport.findOne({ smsFrom: FROM });
    expect(stored.incidentType).toBe('crop_damage');
    expect(stored.locationText).toBe('West Boundary');
    expect(stored.submissionMethod).toBe('sms');

    const completed = await SmsReviewQueue.find({ phone: FROM, status: 'completed' });
    expect(completed.length).toBeGreaterThan(0);
  });

  test('one-shot complete SMS still creates the report directly', async () => {
    const res = await sms('1 SOUTHBOUNDARY', '+94775550004');
    expect(res.body.reportId).toMatch(/^CR-\d{4}-\d{6}$/);
    expect(await ConflictReport.countDocuments({ smsFrom: '+94775550004' })).toBe(1);
  });
});

describe('POST /api/conflict-reports/sync limits', () => {
  test('more than 100 queued reports in one sync is rejected', async () => {
    const reports = Array.from({ length: 101 }, (_, i) => ({
      clientRefId: `ref-${i}`,
      incidentType: 'elephant_sighting',
      location: { coordinates: [81.42, 6.62] }
    }));
    const res = await request(app).post('/api/conflict-reports/sync').send({ reports });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/max 100/);
  });

  test('entries without clientRefId are reported as errors, not stored', async () => {
    const res = await request(app)
      .post('/api/conflict-reports/sync')
      .send({ reports: [{ incidentType: 'crop_damage', location: { coordinates: [81.42, 6.62] } }] });
    expect(res.status).toBe(200);
    expect(res.body.synced).toBe(0);
    expect(res.body.results[0].ok).toBe(false);
  });
});
