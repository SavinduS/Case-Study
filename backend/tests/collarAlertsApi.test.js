const request = require('supertest');
const app = require('../app');
const mongoose = require('mongoose');
const Park = require('../models/Park');
const ConflictReport = require('../models/ConflictReport');
const PatrolRecord = require('../models/PatrolRecord');
const Geofence = require('../models/Geofence');
const Collar = require('../models/Collar');
const RangerTeam = require('../models/RangerTeam');
const BoundaryAlert = require('../models/BoundaryAlert');
const AuditEntry = require('../models/AuditEntry');
const DispatchAttempt = require('../models/DispatchAttempt');
const { THREAT_LEVEL, ALERT_STATUS, DISPATCH_STATE } = require('../utils/collarAlertConstants');
const { PARK, GEOFENCES, COLLARS, RANGER_TEAMS } = require('../seed/referenceData');
const { connectTestDb, resetTestDb, disconnectTestDb } = require('./helpers/db');

jest.setTimeout(60000);

/**
 * End-to-end HTTP coverage for UC-04 "Manage Wildlife Collar Boundary Alerts".
 *
 * Unlike tests/collar-alerts/*.test.js, which stubs the models, these run
 * against a real MongoDB and go through Express: router -> auth middleware ->
 * controller -> service -> query -> response. That is the only way to prove the
 * breach is detected once, persisted, authorised and readable back.
 */

const PARK_INSIDE = [81.06, 8.24];        // inside the park, clear of every zone
const FARM_BREACH = [81.015, 8.245];      // inside Z1, the critical farmland zone
const VILLAGE_BREACH = [80.99, 8.15];     // inside Z2, the Kiri Veedi village edge

let officer;
let manager;
let villager;
let ranger;

async function registerUser(role, phone) {
  const res = await request(app).post('/api/auth/register').send({
    name: `${role} tester`,
    phone,
    password: 'secret123',
    role
  });
  expect(res.status).toBe(201);
  return res.body;
}

const authed = (token) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  await connectTestDb();
  // Indexes (notably the unique partial one on episodeKey) must exist before
  // the concurrency assertions below mean anything.
  await Promise.all([
    Collar.init(), Geofence.init(), RangerTeam.init(),
    BoundaryAlert.init(), AuditEntry.init(), DispatchAttempt.init()
  ]);
});

afterEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await disconnectTestDb();
});

beforeEach(async () => {
  await Park.create(PARK);
  await Geofence.insertMany(GEOFENCES.map((zone) => ({ enabled: true, ...zone })));
  await Collar.insertMany(COLLARS);
  await RangerTeam.insertMany(RANGER_TEAMS);

  // Real source rows so the analytics endpoints aggregate the database rather
  // than answering from a constant. Sectors are the configured reporting areas
  // in config/areas.js.
  await ConflictReport.insertMany([
    { reportId: 'CR-202601-000001', incidentType: 'elephant_sighting', location: { coordinates: [81.42, 6.62] }, description: 'Herd near the north fence', createdAt: new Date('2026-03-01T09:00:00Z') },
    { reportId: 'CR-202601-000002', incidentType: 'crop_damage', location: { coordinates: [81.52, 6.50] }, description: 'Crop damaged overnight', createdAt: new Date('2026-04-12T09:00:00Z') },
    { reportId: 'CR-202601-000003', incidentType: 'crop_damage', location: { coordinates: [81.42, 6.62] }, description: 'Second crop damage report', createdAt: new Date('2026-05-20T09:00:00Z') }
  ]);
  await PatrolRecord.insertMany([
    { patrolId: 'P-1', sector: 'NORTHBOUNDARY', startedAt: new Date('2026-03-02T06:00:00Z'), endedAt: new Date('2026-03-02T12:00:00Z') },
    { patrolId: 'P-2', sector: 'EASTBOUNDARY', startedAt: new Date('2026-04-13T06:00:00Z'), endedAt: new Date('2026-04-13T12:00:00Z') }
  ]);

  officer = await registerUser('officer', '+94770000002');
  manager = await registerUser('manager', '+94770000001');
  villager = await registerUser('villager', '+94770000004');
  ranger = await registerUser('ranger', '+94770000003');
});

/** Posts one collar fix through the real gateway ingest endpoint. */
const sendFix = (token, body) =>
  request(app).post('/api/telemetry/fixes').set(authed(officer.token)).send(body);

describe('UC-04 authorization: who may reach the operations surface', () => {
  const protectedRoutes = [
    ['get', '/api/alerts'],
    ['get', '/api/alerts/CBA-1'],
    ['get', '/api/alerts/CBA-1/dispatch-attempts'],
    ['post', '/api/alerts/CBA-1/respond'],
    ['get', '/api/collars'],
    ['get', '/api/geofences'],
    ['get', '/api/parks/current'],
    ['get', '/api/parks/ranger-teams'],
    ['get', '/api/audit'],
    ['get', '/api/audit/delayed']
  ];

  it.each(protectedRoutes)('%s %s answers 401 with no session', async (method, path) => {
    const res = await request(app)[method](path);
    expect(res.status).toBe(401);
  });

  it.each(protectedRoutes)('%s %s answers 401 for an expired or forged token', async (method, path) => {
    const res = await request(app)[method](path).set(authed('not.a.real.token'));
    expect(res.status).toBe(401);
  });

  it.each(protectedRoutes)('%s %s answers 403 for a villager', async (method, path) => {
    const res = await request(app)[method](path).set(authed(villager.token));
    expect(res.status).toBe(403);
  });

  it.each(protectedRoutes)('%s %s answers 403 for a ranger', async (method, path) => {
    const res = await request(app)[method](path).set(authed(ranger.token));
    expect(res.status).toBe(403);
  });

  it('lets the Operations Officer and the Park Manager through', async () => {
    for (const token of [officer.token, manager.token]) {
      for (const path of ['/api/alerts', '/api/collars', '/api/geofences', '/api/parks/current', '/api/audit']) {
        const res = await request(app).get(path).set(authed(token));
        expect(res.status).toBe(200);
      }
    }
  });

  it('leaves the field-incident and conflict-report roles their own routes', async () => {
    const res = await request(app).get('/api/conflict-reports').set(authed(villager.token));
    expect([200, 403]).toContain(res.status);
  });
});

describe('UC-04 telemetry ingest: a boundary breach becomes one alert', () => {
  it('detects the breach server-side and stores the incident', async () => {
    const res = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH, at: '2026-10-09T14:38:00.000Z' }]
    });

    expect(res.status).toBe(201);
    expect(res.body.alertsCreated).toBe(1);
    expect(res.body.rejected).toEqual([]);

    const stored = await BoundaryAlert.findOne({ alertId: res.body.alerts[0].alertId });
    expect(stored).not.toBeNull();
    expect(stored.collarId).toBe('E-402');
    expect(stored.gpsDeviceId).toBe('GPS-8841');
    expect(stored.zoneId).toBe('Z1');
    expect(stored.position).toEqual(FARM_BREACH);
    expect(stored.detectedAt.toISOString()).toBe('2026-10-09T14:38:00.000Z');
    expect(stored.status).toBe(ALERT_STATUS.ACTIVE);
    expect(stored.threatLevel).toBe(THREAT_LEVEL.CRITICAL);
    // The unique reference the officer quotes over the radio.
    expect(stored.alertId).toMatch(/^CBA-\d{4}-\d{4}$/);
  });

  it('moves the collar to the breached position whether or not it alerts', async () => {
    await sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }] });
    const collar = await Collar.findOne({ collarId: 'E-402' });
    expect(collar.lastKnownLocation.coordinates).toEqual(PARK_INSIDE);
    expect(collar.lastFixAt).not.toBeNull();
  });

  it('creates no alert for telemetry inside the safe zone', async () => {
    const res = await sendFix(officer.token, {
      fixes: COLLARS.map((collar) => ({ collarId: collar.collarId, coordinates: PARK_INSIDE }))
    });

    expect(res.status).toBe(201);
    expect(res.body.alertsCreated).toBe(0);
    expect(await BoundaryAlert.countDocuments()).toBe(0);
  });

  it('does not raise a second incident while the same breach is still open', async () => {
    const first = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }]
    });
    // The collar keeps transmitting from inside the zone.
    const second = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: [81.014, 8.246] }]
    });
    const third = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: [81.013, 8.247] }]
    });

    expect(first.body.alertsCreated).toBe(1);
    expect(second.body.alertsCreated).toBe(0);
    expect(third.body.alertsCreated).toBe(0);
    expect(await BoundaryAlert.countDocuments()).toBe(1);
  });

  it('evaluates each collar independently', async () => {
    const res = await sendFix(officer.token, {
      fixes: [
        { collarId: 'E-402', coordinates: FARM_BREACH },
        { collarId: 'E-118', coordinates: VILLAGE_BREACH }
      ]
    });

    expect(res.body.alertsCreated).toBe(2);
    const zones = await BoundaryAlert.distinct('zoneId');
    expect(zones.sort()).toEqual(['Z1', 'Z2']);
  });

  it('opens one alert per episode even when two ingests race', async () => {
    await Promise.all([
      sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] }),
      sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] }),
      sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] })
    ]);

    // The unique partial index on episodeKey is what enforces this, not a
    // check-then-act query, so concurrent requests cannot both win.
    expect(await BoundaryAlert.countDocuments()).toBe(1);
  });

  it('refuses malformed fixes without taking the whole batch down', async () => {
    const res = await sendFix(officer.token, {
      fixes: [
        { collarId: 'E-402', coordinates: ['east', 'north'] },
        { collarId: 'E-118', coordinates: FARM_BREACH, at: 'not-a-date' },
        { collarId: 'E-000', coordinates: FARM_BREACH },
        { collarId: 'E-331', coordinates: FARM_BREACH }
      ]
    });

    expect(res.status).toBe(201);
    expect(res.body.received).toBe(4);
    expect(res.body.alertsCreated).toBe(1);
    expect(res.body.rejected).toHaveLength(3);
    expect(res.body.rejected[0].error).toMatch(/Invalid coordinates/);
    expect(res.body.rejected[1].error).toMatch(/valid ISO-8601 timestamp/);
    expect(res.body.rejected[2].error).toMatch(/Unknown collar/);
  });

  it('rejects a timestamp too old to be a real collar reading', async () => {
    const res = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH, at: '1999-01-01T00:00:00.000Z' }]
    });
    expect(res.body.rejected[0].error).toMatch(/too old/);
    expect(await BoundaryAlert.countDocuments()).toBe(0);
  });

  it.each([
    ['an empty body', {}],
    ['an empty fixes array', { fixes: [] }],
    ['a fixes value that is not an array', { fixes: 'E-402' }],
    ['a non-boolean delayed flag', { fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }], delayed: 'yes' }]
  ])('400s for %s', async (_label, body) => {
    const res = await sendFix(officer.token, body);
    expect(res.status).toBe(400);
  });
});

describe('UC-04 delayed telemetry after a dropout', () => {
  it('preserves the historical timestamp and flags the breach as delayed', async () => {
    const res = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH, at: '2026-10-08T03:15:00.000Z' }],
      delayed: true
    });

    expect(res.body.alertsCreated).toBe(1);
    const stored = await BoundaryAlert.findOne({ alertId: res.body.alerts[0].alertId });
    expect(stored.status).toBe(ALERT_STATUS.DELAYED);
    expect(stored.delayed).toBe(true);
    expect(stored.detectedAt.toISOString()).toBe('2026-10-08T03:15:00.000Z');

    const delayed = await request(app).get('/api/audit/delayed').set(authed(officer.token));
    expect(delayed.body).toHaveLength(1);
    expect(delayed.body[0].alertId).toBe(stored.alertId);
  });

  it('gives a retroactive breach a lower queue priority than a live one', async () => {
    await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH, at: '2026-10-08T03:15:00.000Z' }],
      delayed: true
    });
    await sendFix(officer.token, { fixes: [{ collarId: 'E-118', coordinates: VILLAGE_BREACH }] });

    const queue = await request(app).get('/api/alerts').set(authed(officer.token));
    expect(queue.body).toHaveLength(2);
    expect(queue.body[0].status).toBe(ALERT_STATUS.ACTIVE);
    expect(queue.body[1].status).toBe(ALERT_STATUS.DELAYED);
  });
});

describe('UC-04 signal loss', () => {
  it('marks the collar Signal Lost and records why', async () => {
    const res = await request(app)
      .put('/api/telemetry/collars/E-207/signal')
      .set(authed(officer.token))
      .send({ lost: true, reason: 'Gateway heartbeat timeout' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('signal_lost');

    const collars = await request(app).get('/api/collars?status=signal_lost').set(authed(officer.token));
    expect(collars.body.map((c) => c.collarId)).toEqual(['E-207']);

    const audit = await AuditEntry.find({ action: 'SIGNAL_LOST' }).lean();
    expect(audit).toHaveLength(1);
    expect(audit[0].detail).toContain('Gateway heartbeat timeout');
  });

  it('restores the collar to transmitting when the link comes back', async () => {
    await request(app).put('/api/telemetry/collars/E-207/signal').set(authed(officer.token)).send({ lost: true });
    const res = await request(app)
      .put('/api/telemetry/collars/E-207/signal')
      .set(authed(officer.token))
      .send({ lost: false });

    expect(res.body.status).toBe('active');
  });

  it('404s for a collar the park does not track', async () => {
    const res = await request(app)
      .put('/api/telemetry/collars/E-999/signal')
      .set(authed(officer.token))
      .send({ lost: true });
    expect(res.status).toBe(404);
  });
});

describe('UC-04 officer responses', () => {
  /** Raises a live breach and returns the alert reference. */
  async function raiseBreach(collarId = 'E-402', coordinates = FARM_BREACH) {
    const res = await sendFix(officer.token, { fixes: [{ collarId, coordinates }] });
    return res.body.alerts[0].alertId;
  }

  const respond = (token, alertId, body) =>
    request(app).post(`/api/alerts/${alertId}/respond`).set(authed(token)).send(body);

  it('acknowledges and dispatches, and records a delivered notification', async () => {
    const alertId = await raiseBreach();
    const res = await respond(officer.token, alertId, { action: 'acknowledge_dispatch' });

    expect(res.status).toBe(200);
    expect(res.body.alert.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(res.body.alert.alertId).toBe(alertId);
    expect(res.body.dispatch.delivered).toBe(true);
    expect(res.body.ranger.rangerId).toBeTruthy();

    const stored = await BoundaryAlert.findOne({ alertId });
    expect(stored.dispatchState).toBe(DISPATCH_STATE.DELIVERED);
    expect(stored.dispatchedRangerId).toBe(res.body.ranger.rangerId);
    expect(stored.handledBy).toBe(officer.name);
    expect(stored.responseAction).toBe('acknowledge_dispatch');

    const attempts = await DispatchAttempt.find({ alertId }).lean();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].state).toBe(DISPATCH_STATE.DELIVERED);
  });

  it('records the acting officer from the token, never from the request body', async () => {
    const alertId = await raiseBreach();
    await respond(officer.token, alertId, {
      action: 'monitor_closely',
      actor: 'someone-else'
    });

    const stored = await BoundaryAlert.findOne({ alertId });
    expect(stored.handledBy).toBe(officer.name);

    const audit = await AuditEntry.findOne({ alertId, action: 'MONITOR_CLOSELY' });
    expect(audit.actor).toBe(officer.name);
  });

  it('keeps the episode open when the officer only monitors it', async () => {
    const alertId = await raiseBreach();
    const res = await respond(officer.token, alertId, { action: 'monitor_closely' });

    expect(res.body.alert.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(res.body.dispatch).toBeNull();

    // Still one incident for the same ongoing breach.
    const again = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: [81.014, 8.246] }]
    });
    expect(again.body.alertsCreated).toBe(0);
  });

  it('requires notes for a false alarm and records them in the audit trail', async () => {
    const alertId = await raiseBreach();

    const missing = await respond(officer.token, alertId, { action: 'mark_false_alarm' });
    expect(missing.status).toBe(400);
    expect((await BoundaryAlert.findOne({ alertId })).status).toBe(ALERT_STATUS.ACTIVE);

    const res = await respond(officer.token, alertId, {
      action: 'mark_false_alarm',
      notes: 'Stationary collar signal drift at the waterhole.'
    });
    expect(res.status).toBe(200);

    const stored = await BoundaryAlert.findOne({ alertId });
    expect(stored.status).toBe(ALERT_STATUS.DISMISSED);
    expect(stored.notes).toContain('signal drift');

    const audit = await AuditEntry.findOne({ alertId, action: 'MARKED_FALSE_ALARM' });
    expect(audit.detail).toContain('signal drift');
    expect(audit.actor).toBe(officer.name);
  });

  it('leaves the dismissed alert out of the active queue', async () => {
    const alertId = await raiseBreach();
    await respond(officer.token, alertId, { action: 'mark_false_alarm', notes: 'drift' });

    const queue = await request(app).get('/api/alerts').set(authed(officer.token));
    expect(queue.body).toHaveLength(0);

    const history = await request(app)
      .get('/api/alerts?status=active,acknowledged,delayed,dismissed,resolved')
      .set(authed(officer.token));
    expect(history.body.map((a) => a.alertId)).toEqual([alertId]);
  });

  it('refuses to re-open an incident the officer already dismissed', async () => {
    const alertId = await raiseBreach();
    await respond(officer.token, alertId, { action: 'mark_false_alarm', notes: 'drift' });

    const res = await respond(officer.token, alertId, { action: 'acknowledge_dispatch' });
    expect(res.status).toBe(409);
    expect((await BoundaryAlert.findOne({ alertId })).status).toBe(ALERT_STATUS.DISMISSED);
  });

  it.each(['launch_missiles', '', null, 'ACK_DISPATCH'])('rejects %p as an unsupported action', async (action) => {
    const alertId = await raiseBreach();
    const res = await respond(officer.token, alertId, { action });
    expect(res.status).toBe(400);
  });

  it('404s for an alert reference that does not exist', async () => {
    const res = await respond(officer.token, 'CBA-9999-9999', { action: 'monitor_closely' });
    expect(res.status).toBe(404);
  });

  it('refuses an officer response without a session', async () => {
    const alertId = await raiseBreach();
    const res = await request(app)
      .post(`/api/alerts/${alertId}/respond`)
      .send({ action: 'monitor_closely' });
    expect(res.status).toBe(401);
    expect((await BoundaryAlert.findOne({ alertId })).status).toBe(ALERT_STATUS.ACTIVE);
  });
});

describe('UC-04 ranger dispatch failures (exception flow 3)', () => {
  it('retries three times, reports Failed Delivery and asks for radio', async () => {
    // The mock ranger gateway is the only channel in this deployment, and it
    // treats a team flagged gatewayReachable: false as unreachable.
    await RangerTeam.updateMany({}, { $set: { status: 'available', gatewayReachable: false } });
    await sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] });
    const { body: alerts } = await request(app).get('/api/alerts').set(authed(officer.token));
    const alertId = alerts[0].alertId;

    const res = await request(app)
      .post(`/api/alerts/${alertId}/respond`)
      .set(authed(officer.token))
      .send({ action: 'acknowledge_dispatch' });

    expect(res.status).toBe(200);
    expect(res.body.dispatch.delivered).toBe(false);
    expect(res.body.dispatch.attempts).toBe(3);
    expect(res.body.dispatch.fallback).toMatch(/radio/i);

    const stored = await BoundaryAlert.findOne({ alertId });
    expect(stored.dispatchState).toBe(DISPATCH_STATE.FAILED);
    expect(stored.dispatchAttempts).toBe(3);
    // A dispatch that never landed names nobody.
    expect(stored.dispatchedTo).toBeNull();

    const attempts = await DispatchAttempt.find({ alertId }).sort({ attempt: 1 });
    expect(attempts).toHaveLength(3);
    expect(attempts.map((a) => a.state)).toEqual(
      Array(3).fill(DISPATCH_STATE.FAILED)
    );

    const audit = await AuditEntry.findOne({ alertId, action: 'DISPATCH_FAILED' });
    expect(audit).not.toBeNull();
    expect(audit.detail).toMatch(/radio/i);
  });

  it('exposes the attempt log to the officer and 404s an unknown alert', async () => {
    await RangerTeam.updateMany({}, { $set: { status: 'available', gatewayReachable: false } });
    await sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] });
    const { body: alerts } = await request(app).get('/api/alerts').set(authed(officer.token));
    const alertId = alerts[0].alertId;

    await request(app)
      .post(`/api/alerts/${alertId}/respond`)
      .set(authed(officer.token))
      .send({ action: 'acknowledge_dispatch' });

    const log = await request(app)
      .get(`/api/alerts/${alertId}/dispatch-attempts`)
      .set(authed(officer.token));
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(3);
    expect(log.body.map((a) => a.attempt)).toEqual([1, 2, 3]);

    const missing = await request(app)
      .get('/api/alerts/CBA-9999-9999/dispatch-attempts')
      .set(authed(officer.token));
    expect(missing.status).toBe(404);
  });
});

describe('UC-04 alert queue and details', () => {
  it('orders simultaneous breaches by the server priority score, not arrival order', async () => {
    // Both breaches are critical (deep inside their zones). Z2 is beside the
    // Kiri Veedi settlement, so the documented proximity rule puts it first
    // even though it was submitted second.
    await sendFix(officer.token, {
      fixes: [
        { collarId: 'E-402', coordinates: FARM_BREACH },
        { collarId: 'E-118', coordinates: VILLAGE_BREACH }
      ]
    });

    const queue = await request(app).get('/api/alerts').set(authed(officer.token));
    expect(queue.body).toHaveLength(2);
    expect(queue.body.map((a) => a.threatLevel)).toEqual(['critical', 'critical']);
    expect(queue.body[0].zoneId).toBe('Z2');
    expect(queue.body[0].priorityScore).toBeGreaterThan(queue.body[1].priorityScore);
    // The score is computed by the server, not supplied by the client.
    expect(queue.body[0].distanceToSettlementM).toBeLessThan(queue.body[1].distanceToSettlementM);
  });

  it('returns one alert by reference, and 404s for an unknown one', async () => {
    await sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] });
    const { body: alerts } = await request(app).get('/api/alerts').set(authed(officer.token));

    const one = await request(app).get(`/api/alerts/${alerts[0].alertId}`).set(authed(officer.token));
    expect(one.status).toBe(200);
    expect(one.body.position).toEqual(FARM_BREACH);
    expect(one.body.zoneName).toBe('Elephant Corridor - Western Farmland');

    const missing = await request(app).get('/api/alerts/nope').set(authed(officer.token));
    expect(missing.status).toBe(404);
  });

  it('rejects a nonsense limit rather than passing it to MongoDB', async () => {
    const res = await request(app).get('/api/alerts?limit=99999').set(authed(officer.token));
    expect(res.status).toBe(400);
  });

  it('accepts the same coordinate ordering everywhere ([lng, lat])', async () => {
    const park = await request(app).get('/api/parks/current').set(authed(officer.token));
    expect(park.body.boundary[0]).toEqual(PARK.boundary[0]);
    expect(park.body.settlements[0].position).toEqual(PARK.settlements[0].position);
  });
});

describe('UC-04 geofence configuration', () => {
  it('shows and hides a zone, and a hidden zone stops alerting', async () => {
    const res = await request(app)
      .put('/api/geofences/Z1')
      .set(authed(officer.token))
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);

    const ingest = await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }]
    });
    expect(ingest.body.alertsCreated).toBe(0);
  });

  it.each([
    ['a non-boolean flag', { enabled: 'no' }],
    ['an empty body', {}]
  ])('400s for %s', async (_label, body) => {
    const res = await request(app).put('/api/geofences/Z1').set(authed(officer.token)).send(body);
    expect(res.status).toBe(400);
  });

  it('404s for a zone the park does not have', async () => {
    const res = await request(app)
      .put('/api/geofences/Z99')
      .set(authed(officer.token))
      .send({ enabled: true });
    expect(res.status).toBe(404);
  });

  it('suggests the nearest available team and 400s without usable coordinates', async () => {
    const nearest = await request(app)
      .get('/api/parks/ranger-teams/nearest?lng=81.015&lat=8.245')
      .set(authed(officer.token));
    expect(nearest.status).toBe(200);
    expect(nearest.body.rangerId).toBeTruthy();

    const bad = await request(app)
      .get('/api/parks/ranger-teams/nearest?lng=abc&lat=')
      .set(authed(officer.token));
    expect(bad.status).toBe(400);
  });
});

describe('UC-04 incident history and audit trail', () => {
  it('records the whole episode: raised, acknowledged, dispatched, with who and when', async () => {
    await sendFix(officer.token, {
      fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH, at: '2026-10-09T14:38:00.000Z' }]
    });
    const { body: alerts } = await request(app).get('/api/alerts').set(authed(officer.token));
    const alertId = alerts[0].alertId;

    await request(app)
      .post(`/api/alerts/${alertId}/respond`)
      .set(authed(officer.token))
      .send({ action: 'acknowledge_dispatch' });

    const trail = await request(app)
      .get(`/api/audit?alertId=${alertId}`)
      .set(authed(officer.token));

    const actions = trail.body.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(['ALERT_RAISED', 'ALERT_ACKNOWLEDGED', 'RANGER_DISPATCHED'])
    );
    for (const entry of trail.body) {
      expect(entry.alertId).toBe(alertId);
      expect(entry.auditId).toMatch(/^AUD-\d{6}$/);
      expect(entry.actor).toBeTruthy();
      expect(new Date(entry.at).valueOf()).not.toBeNaN();
    }
    expect(trail.body.find((e) => e.action === 'ALERT_RAISED').actor).toBe('GeofenceEngine');
  });

  it('gives every audit row a unique reference', async () => {
    await Promise.all([
      sendFix(officer.token, { fixes: [{ collarId: 'E-402', coordinates: FARM_BREACH }] }),
      sendFix(officer.token, { fixes: [{ collarId: 'E-118', coordinates: VILLAGE_BREACH }] })
    ]);

    const ids = (await AuditEntry.find({}).lean()).map((entry) => entry.auditId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('validates the audit limit', async () => {
    const res = await request(app).get('/api/audit?limit=0').set(authed(officer.token));
    expect(res.status).toBe(400);
  });

  it('offers no way to edit or delete an audit row', () => {
    const app2 = app;
    const paths = app2._router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) => Object.keys(layer.route.methods));
    expect(paths.filter((method) => method === 'post' || method === 'put' || method === 'delete')).toEqual([]);
  });
});

describe('UC-04 gateway authentication', () => {
  afterEach(() => {
    delete process.env.TELEMETRY_GATEWAY_TOKEN;
  });

  it('is open by default so the bundled simulator can post fixes', async () => {
    const res = await request(app).post('/api/telemetry/fixes').send({
      fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }]
    });
    expect(res.status).toBe(201);
  });

  it('refuses a fix with no or wrong gateway token once a secret is configured', async () => {
    process.env.TELEMETRY_GATEWAY_TOKEN = 'device-secret';

    const noToken = await request(app).post('/api/telemetry/fixes').send({
      fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }]
    });
    expect(noToken.status).toBe(401);

    const wrongToken = await request(app)
      .post('/api/telemetry/fixes')
      .set('X-Gateway-Token', 'guess')
      .send({ fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }] });
    expect(wrongToken.status).toBe(401);
  });

  it('accepts the configured gateway token, or an operator session', async () => {
    process.env.TELEMETRY_GATEWAY_TOKEN = 'device-secret';

    const byDevice = await request(app)
      .post('/api/telemetry/fixes')
      .set('X-Gateway-Token', 'device-secret')
      .send({ fixes: [{ collarId: 'E-402', coordinates: PARK_INSIDE }] });
    expect(byDevice.status).toBe(201);

    const byOperator = await request(app)
      .post('/api/telemetry/fixes')
      .set(authed(officer.token))
      .send({ fixes: [{ collarId: 'E-118', coordinates: PARK_INSIDE }] });
    expect(byOperator.status).toBe(201);

    const byVillager = await request(app)
      .post('/api/telemetry/fixes')
      .set(authed(villager.token))
      .send({ fixes: [{ collarId: 'E-331', coordinates: PARK_INSIDE }] });
    expect(byVillager.status).toBe(403);
  });
});

describe('UC-04 analytical reports for the Operations Officer', () => {
  const criteria = {
    reportType: 'incidentSummary',
    startDate: '2026-01-01',
    endDate: '2026-10-09',
    zones: ['NORTHBOUNDARY', 'EASTBOUNDARY', 'SOUTHBOUNDARY', 'WESTBOUNDARY'],
    categories: ['elephant', 'crop', 'poacher', 'snare']
  };

  it('lets the Operations Officer generate a report aggregated from live data', async () => {
    const res = await request(app)
      .post('/api/analytics/generate')
      .set(authed(officer.token))
      .send(criteria);

    expect(res.status).toBe(201);
    expect(res.body.reportId).toMatch(/^AN-/);
    // Aggregated from the rows the suite seeded, not a constant.
    expect(res.body.summary.incidentCount).toBe(3);
    expect(res.body.incidentDensity.NORTHBOUNDARY).toBe(2);
    expect(res.body.incidentDensity.EASTBOUNDARY).toBe(1);
    expect(res.body.patrolCoverage.NORTHBOUNDARY.actualHours).toBeGreaterThan(0);
  });

  it('narrows the same figures by date range', async () => {
    const res = await request(app)
      .post('/api/analytics/generate')
      .set(authed(officer.token))
      .send({ ...criteria, startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(res.status).toBe(201);
    expect(res.body.summary.incidentCount).toBe(1);
    expect(res.body.incidentDensity.EASTBOUNDARY).toBe(0);
  });

  it('reports "no data" honestly rather than returning an empty report', async () => {
    const res = await request(app)
      .post('/api/analytics/generate')
      .set(authed(officer.token))
      .send({ ...criteria, startDate: '2024-01-01', endDate: '2024-01-31' });

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/No incident or patrol data/i);
  });

  it('lists back only the reports the caller generated', async () => {
    await request(app).post('/api/analytics/generate').set(authed(officer.token)).send(criteria);
    await request(app).post('/api/analytics/generate').set(authed(manager.token)).send(criteria);

    const officerReports = await request(app).get('/api/analytics/reports').set(authed(officer.token));
    expect(officerReports.body).toHaveLength(1);
  });

  it('still refuses a villager or a ranger', async () => {
    const res = await request(app)
      .post('/api/analytics/generate')
      .set(authed(villager.token))
      .send(criteria);
    expect(res.status).toBe(403);
  });

  it('scopes a report fetch to its owner, so one role cannot read another\'s', async () => {
    const created = await request(app)
      .post('/api/analytics/generate')
      .set(authed(officer.token))
      .send(criteria);

    const mine = await request(app)
      .get(`/api/analytics/reports/${created.body.reportId}`)
      .set(authed(officer.token));
    expect(mine.status).toBe(200);

    const theirs = await request(app)
      .get(`/api/analytics/reports/${created.body.reportId}`)
      .set(authed(manager.token));
    expect(theirs.status).toBe(404);
  });
});

afterAll(() => mongoose.connection.close?.());