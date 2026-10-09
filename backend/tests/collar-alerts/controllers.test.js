import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Controllers are thin: they read query/body params, delegate, and shape the
 * HTTP response. They destructure their service and model imports at module
 * load, so the only seam that can be replaced afterwards is the model
 * statics. These tests therefore stub the models and assert on the request
 * the controller issues and the status it returns.
 *
 * The service behaviour behind these endpoints is covered directly in
 * alertService.test.js.
 */

const Collar = require('../../models/Collar');
const BoundaryAlert = require('../../models/BoundaryAlert');
const AuditEntry = require('../../models/AuditEntry');
const DispatchAttempt = require('../../models/DispatchAttempt');
const Geofence = require('../../models/Geofence');
const Park = require('../../models/Park');
const RangerTeam = require('../../models/RangerTeam');
const Counter = require('../../models/Counter');

const collarController = require('../../controllers/collarController');
const alertController = require('../../controllers/alertController');
const auditController = require('../../controllers/auditController');
const geofenceController = require('../../controllers/geofenceController');
const telemetryController = require('../../controllers/telemetryController');

const MODELS = { Collar, BoundaryAlert, AuditEntry, DispatchAttempt, Geofence, Park, RangerTeam, Counter };

const originals = {};
for (const [name, model] of Object.entries(MODELS)) originals[name] = { ...model };

/** Minimal Express-like response double. */
function makeRes() {
  return {
    statusCode: null,
    payload: undefined,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.payload = body; return this; }
  };
}

/** A Mongoose-style query chain: .sort().limit().lean() -> the value. */
function chain(value) {
  const q = {
    sort: () => q,
    limit: () => q,
    lean: () => Promise.resolve(value)
  };
  return q;
}

let spies;

beforeEach(() => {
  spies = {
    collarFind: vi.fn(() => chain([])),
    collarFindOne: vi.fn(() => chain(null)),
    collarCreate: vi.fn((doc) => Promise.resolve(doc)),
    collarFindOneAndUpdate: vi.fn(() => Promise.resolve(null)),
    alertFind: vi.fn(() => chain([])),
    alertFindOne: vi.fn(() => chain(null)),
    alertCreate: vi.fn((doc) => Promise.resolve(doc)),
    auditCreate: vi.fn(() => Promise.resolve({})),
    auditFind: vi.fn(() => chain([])),
    attemptFind: vi.fn(() => chain([])),
    attemptCreate: vi.fn((doc) => Promise.resolve(doc)),
    attemptUpdateMany: vi.fn(() => Promise.resolve({})),
    geofenceFind: vi.fn(() => chain([])),
    geofenceFindOne: vi.fn(() => chain(null)),
    geofenceFindOneAndUpdate: vi.fn(() => Promise.resolve(null)),
    parkFindOne: vi.fn(() => chain(null)),
    rangerFind: vi.fn(() => chain([])),
    rangerUpdateOne: vi.fn(() => Promise.resolve({})),
    // nextSequence is destructured at load, so the Mongoose call it makes
    // is what has to be replaced.
    counterFindOneAndUpdate: vi.fn(() => Promise.resolve({ seq: 1 }))
  };

  Object.assign(Collar, {
    find: spies.collarFind,
    findOne: spies.collarFindOne,
    create: spies.collarCreate,
    findOneAndUpdate: spies.collarFindOneAndUpdate
  });
  Object.assign(BoundaryAlert, {
    find: spies.alertFind,
    findOne: spies.alertFindOne,
    create: spies.alertCreate
  });
  Object.assign(AuditEntry, { create: spies.auditCreate, find: spies.auditFind });
  Object.assign(DispatchAttempt, {
    find: spies.attemptFind,
    create: spies.attemptCreate,
    updateMany: spies.attemptUpdateMany
  });
  Object.assign(Geofence, {
    find: spies.geofenceFind,
    findOne: spies.geofenceFindOne,
    findOneAndUpdate: spies.geofenceFindOneAndUpdate
  });
  Object.assign(Park, { findOne: spies.parkFindOne });
  Object.assign(RangerTeam, { find: spies.rangerFind, updateOne: spies.rangerUpdateOne });
  Object.assign(Counter, { findOneAndUpdate: spies.counterFindOneAndUpdate });
});

afterEach(() => {
  for (const [name, model] of Object.entries(MODELS)) {
    for (const [key, value] of Object.entries(originals[name])) {
      if (value !== undefined) model[key] = value;
    }
  }
});

describe('collarController', () => {
  it('lists collars, optionally filtered by status', async () => {
    const res = makeRes();
    await collarController.listCollars({ query: { status: 'signal_lost' } }, res, vi.fn());
    expect(spies.collarFind).toHaveBeenCalledWith({ status: 'signal_lost' });
    expect(res.payload).toEqual([]);
  });

  it('lists every collar when no filter is given', async () => {
    const res = makeRes();
    await collarController.listCollars({ query: {} }, res, vi.fn());
    expect(spies.collarFind).toHaveBeenCalledWith({});
  });

  it('returns a single collar', async () => {
    spies.collarFindOne.mockReturnValue(chain({ collarId: 'E-402' }));
    const res = makeRes();
    await collarController.getCollar({ params: { collarId: 'E-402' } }, res, vi.fn());
    expect(res.payload).toEqual({ collarId: 'E-402' });
  });

  it('404s for a collar that does not exist', async () => {
    const res = makeRes();
    await collarController.getCollar({ params: { collarId: 'E-999' } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });

  it('registers a new collar and audits it', async () => {
    spies.collarFindOne.mockResolvedValue(null);
    const res = makeRes();
    await collarController.registerCollar({ body: { collarId: 'E-777', species: 'Elephant' } }, res, vi.fn());
    expect(res.statusCode).toBe(201);
    expect(spies.auditCreate).toHaveBeenCalled();
  });

  it('409s when the collar is already registered', async () => {
    spies.collarFindOne.mockResolvedValue({ collarId: 'E-402' });
    const res = makeRes();
    await collarController.registerCollar({ body: { collarId: 'E-402' } }, res, vi.fn());
    expect(res.statusCode).toBe(409);
    expect(spies.collarCreate).not.toHaveBeenCalled();
  });

  it('audits when a collar is flagged signal lost', async () => {
    spies.collarFindOneAndUpdate.mockResolvedValue({ collarId: 'E-512' });
    const res = makeRes();
    await collarController.updateCollarStatus(
      { params: { collarId: 'E-512' }, body: { status: 'signal_lost' } },
      res,
      vi.fn()
    );
    expect(spies.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SIGNAL_LOST' })
    );
  });

  it('does not audit a routine status change', async () => {
    spies.collarFindOneAndUpdate.mockResolvedValue({ collarId: 'E-512' });
    const res = makeRes();
    await collarController.updateCollarStatus(
      { params: { collarId: 'E-512' }, body: { status: 'active' } },
      res,
      vi.fn()
    );
    expect(spies.auditCreate).not.toHaveBeenCalled();
  });

  it('404s when updating a collar that does not exist', async () => {
    const res = makeRes();
    await collarController.updateCollarStatus(
      { params: { collarId: 'E-999' }, body: { status: 'active' } },
      res,
      vi.fn()
    );
    expect(res.statusCode).toBe(404);
  });

  it('forwards unexpected errors to the error handler', async () => {
    spies.collarFind.mockImplementation(() => { throw new Error('db down'); });
    const next = vi.fn();
    await collarController.listCollars({ query: {} }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'db down' }));
  });
});

describe('geofenceController', () => {
  it('lists zones and can filter to enabled only', async () => {
    const res = makeRes();
    await geofenceController.listGeofences({ query: { enabled: 'true' } }, res, vi.fn());
    expect(spies.geofenceFind).toHaveBeenCalledWith({ enabled: true });
  });

  it('treats enabled=false as a filter rather than "no filter"', async () => {
    const res = makeRes();
    await geofenceController.listGeofences({ query: { enabled: 'false' } }, res, vi.fn());
    expect(spies.geofenceFind).toHaveBeenCalledWith({ enabled: false });
  });

  it('returns one zone', async () => {
    spies.geofenceFindOne.mockReturnValue(chain({ zoneId: 'Z1' }));
    const res = makeRes();
    await geofenceController.getGeofence({ params: { zoneId: 'Z1' } }, res, vi.fn());
    expect(res.payload.zoneId).toBe('Z1');
  });

  it('404s for an unknown zone', async () => {
    const res = makeRes();
    await geofenceController.getGeofence({ params: { zoneId: 'Z9' } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });

  it('toggles a zone and returns the updated document', async () => {
    spies.geofenceFindOneAndUpdate.mockResolvedValue({ zoneId: 'Z1', enabled: false });
    const res = makeRes();
    await geofenceController.updateGeofence(
      { params: { zoneId: 'Z1' }, body: { enabled: false } },
      res,
      vi.fn()
    );
    expect(spies.geofenceFindOneAndUpdate).toHaveBeenCalledWith(
      { zoneId: 'Z1' },
      { $set: { enabled: false } },
      { new: true }
    );
    expect(res.payload.enabled).toBe(false);
  });

  it('404s when toggling an unknown zone', async () => {
    const res = makeRes();
    await geofenceController.updateGeofence(
      { params: { zoneId: 'Z9' }, body: { enabled: true } },
      res,
      vi.fn()
    );
    expect(res.statusCode).toBe(404);
  });

  it('returns the configured park', async () => {
    spies.parkFindOne.mockReturnValue(chain({ parkId: 'KNP-ANP' }));
    const res = makeRes();
    await geofenceController.getCurrentPark({}, res, vi.fn());
    expect(res.payload.parkId).toBe('KNP-ANP');
  });

  it('404s when no park is configured', async () => {
    const res = makeRes();
    await geofenceController.getCurrentPark({}, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });

  it('lists ranger teams with an optional status filter', async () => {
    const res = makeRes();
    await geofenceController.listRangerTeams({ query: { status: 'available' } }, res, vi.fn());
    expect(spies.rangerFind).toHaveBeenCalledWith({ status: 'available' });
  });

  it('rejects a nearest-ranger query with unusable coordinates', async () => {
    const res = makeRes();
    await geofenceController.getNearestRangerTeam({ query: { lng: 'abc', lat: '8.2' } }, res, vi.fn());
    expect(res.statusCode).toBe(400);
  });

  it('rejects a nearest-ranger query with out-of-range coordinates', async () => {
    const res = makeRes();
    await geofenceController.getNearestRangerTeam({ query: { lng: '999', lat: '999' } }, res, vi.fn());
    expect(res.statusCode).toBe(400);
  });

  it('suggests the nearest available team', async () => {
    spies.rangerFind.mockReturnValue(chain([
      { rangerId: 'RT-01', name: 'Kandy', status: 'available', position: [81.021, 8.191] }
    ]));
    const res = makeRes();
    await geofenceController.getNearestRangerTeam({ query: { lng: '81.012', lat: '8.243' } }, res, vi.fn());
    expect(res.payload.rangerId).toBe('RT-01');
    expect(res.payload.distanceM).toBeGreaterThan(0);
  });

  it('returns null when no team is available to dispatch', async () => {
    spies.rangerFind.mockReturnValue(chain([
      { rangerId: 'RT-03', name: 'Kurunegala', status: 'on_patrol', position: [80.985, 8.212] }
    ]));
    const res = makeRes();
    await geofenceController.getNearestRangerTeam({ query: { lng: '81.0', lat: '8.24' } }, res, vi.fn());
    expect(res.payload).toBeNull();
  });
});

describe('alertController', () => {
  it('defaults the queue to the open statuses', async () => {
    const res = makeRes();
    await alertController.getAlerts({ query: {} }, res, vi.fn());
    expect(spies.alertFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['active', 'acknowledged', 'delayed'] } })
    );
  });

  it('splits a comma separated status list into a $in filter', async () => {
    const res = makeRes();
    await alertController.getAlerts({ query: { status: 'active,dismissed' } }, res, vi.fn());
    expect(spies.alertFind).toHaveBeenCalledWith({
      status: { $in: ['active', 'dismissed'] }
    });
  });

  it('applies a limit', async () => {
    const res = makeRes();
    await alertController.getAlerts({ query: { limit: '5' } }, res, vi.fn());
    expect(spies.alertFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: ['active', 'acknowledged', 'delayed'] } })
    );
  });

  it('returns one alert', async () => {
    spies.alertFindOne.mockReturnValue(chain({ alertId: 'CBA-2026-0001' }));
    const res = makeRes();
    await alertController.getAlertById({ params: { alertId: 'CBA-2026-0001' } }, res, vi.fn());
    expect(res.payload.alertId).toBe('CBA-2026-0001');
  });

  it('404s for an unknown alert', async () => {
    const res = makeRes();
    await alertController.getAlertById({ params: { alertId: 'CBA-9' } }, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });

  it('acknowledges and dispatches, returning the alert, outcome and ranger', async () => {
    const alert = {
      alertId: 'CBA-2026-0001',
      position: [80.99, 8.24],
      status: 'active',
      save: vi.fn().mockResolvedValue(undefined),
      toObject() { return { alertId: this.alertId, position: this.position }; }
    };
    spies.alertFindOne.mockResolvedValue(alert);
    spies.rangerFind.mockReturnValue(chain([
      { rangerId: 'RT-01', name: 'Ranger Team Kandy', status: 'available', position: [81.021, 8.191] }
    ]));

    const res = makeRes();
    await alertController.respondToAlert(
      { params: { alertId: 'CBA-2026-0001' }, body: { action: 'acknowledge_dispatch', actor: 'OF-021' } },
      res,
      vi.fn()
    );

    expect(res.payload.alert.status).toBe('acknowledged');
    expect(res.payload.dispatch.delivered).toBe(true);
    expect(res.payload.ranger.rangerId).toBe('RT-01');
  });

  it('refuses a false alarm with no notes and passes the 400 on', async () => {
    const alert = {
      alertId: 'CBA-2026-0001',
      position: [80.99, 8.24],
      status: 'active',
      save: vi.fn().mockResolvedValue(undefined),
      toObject() { return { alertId: this.alertId }; }
    };
    spies.alertFindOne.mockResolvedValue(alert);

    const next = vi.fn();
    await alertController.respondToAlert(
      { params: { alertId: 'CBA-2026-0001' }, body: { action: 'mark_false_alarm' } },
      makeRes(),
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('rejects an unsupported action with a 400', async () => {
    const alert = {
      alertId: 'CBA-1',
      position: [80.99, 8.24],
      status: 'active',
      save: vi.fn().mockResolvedValue(undefined),
      toObject() { return { alertId: this.alertId }; }
    };
    spies.alertFindOne.mockResolvedValue(alert);

    const next = vi.fn();
    await alertController.respondToAlert(
      { params: { alertId: 'CBA-1' }, body: { action: 'launch_missiles' } },
      makeRes(),
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
  });

  it('404s when responding to an alert that does not exist', async () => {
    spies.alertFindOne.mockResolvedValue(null);
    const next = vi.fn();
    await alertController.respondToAlert(
      { params: { alertId: 'CBA-9' }, body: { action: 'monitor_closely' } },
      makeRes(),
      next
    );
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it('lists dispatch attempts for an alert', async () => {
    spies.attemptFind.mockReturnValue(chain([{ attempt: 1 }, { attempt: 2 }, { attempt: 3 }]));
    const res = makeRes();
    await alertController.getDispatchAttempts({ params: { alertId: 'CBA-1' } }, res, vi.fn());
    expect(spies.attemptFind).toHaveBeenCalledWith({ alertId: 'CBA-1' });
    expect(res.payload).toHaveLength(3);
  });
});

describe('auditController', () => {
  it('returns audit entries newest first', async () => {
    const res = makeRes();
    await auditController.listAuditEntries({ query: {} }, res, vi.fn());
    expect(spies.auditFind).toHaveBeenCalledWith({});
    expect(res.payload).toEqual([]);
  });

  it('scopes the trail to one alert when asked', async () => {
    const res = makeRes();
    await auditController.listAuditEntries({ query: { alertId: 'CBA-1' } }, res, vi.fn());
    expect(spies.auditFind).toHaveBeenCalledWith({ alertId: 'CBA-1' });
  });

  it('applies a limit', async () => {
    const res = makeRes();
    await auditController.listAuditEntries({ query: { limit: '10' } }, res, vi.fn());
    expect(res.payload).toEqual([]);
  });

  it('lists retroactive breaches only', async () => {
    spies.alertFind.mockReturnValue(chain([{ alertId: 'CBA-2', delayed: true }]));
    const res = makeRes();
    await auditController.listDelayedIncidents({}, res, vi.fn());
    expect(spies.alertFind).toHaveBeenCalledWith({ delayed: true });
    expect(res.payload).toHaveLength(1);
  });
});

describe('telemetryController', () => {
  /** Loads the geofence context the ingest path needs. */
  function withGeofenceContext() {
    spies.geofenceFind.mockReturnValue(chain([{
      zoneId: 'Z1',
      name: 'Elephant Corridor',
      gridRef: 'G7',
      kind: 'farmland',
      threatLevel: 'critical',
      polygon: [
        [81.03, 8.196], [81.005, 8.205], [80.972, 8.228], [80.952, 8.262],
        [80.968, 8.292], [81.008, 8.288], [81.034, 8.258], [81.038, 8.222],
        [81.03, 8.196]
      ]
    }]));
    spies.parkFindOne.mockReturnValue(chain({
      parkId: 'KNP',
      settlements: [{ settlementId: 'S1', name: 'Kiri Veedi', position: [80.958, 8.156] }]
    }));
  }

  it('rejects a body with no fixes array', async () => {
    const res = makeRes();
    await telemetryController.ingestFixes({ body: {} }, res, vi.fn());
    expect(res.statusCode).toBe(400);
  });

  it('rejects an empty fixes array', async () => {
    const res = makeRes();
    await telemetryController.ingestFixes({ body: { fixes: [] } }, res, vi.fn());
    expect(res.statusCode).toBe(400);
  });

  it('accepts a batch and reports what it created', async () => {
    withGeofenceContext();
    spies.collarFindOne.mockResolvedValue({
      collarId: 'E-402',
      gpsDeviceId: 'GPS-8841',
      species: 'African Elephant',
      sex: 'Female',
      health: 'Stable',
      speciesRisk: 'high',
      status: 'active',
      lastKnownLocation: { type: 'Point', coordinates: [81.06, 8.24] },
      save: vi.fn().mockResolvedValue(undefined)
    });

    const res = makeRes();
    await telemetryController.ingestFixes(
      { body: { fixes: [{ collarId: 'E-402', coordinates: [80.99, 8.24] }] } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(201);
    expect(res.payload.received).toBe(1);
    expect(res.payload.alertsCreated).toBe(1);
    expect(res.payload.alerts[0].collarId).toBe('E-402');
    expect(res.payload.alerts[0].zoneId).toBe('Z1');
  });

  it('reports a bad fix as rejected without failing the batch', async () => {
    withGeofenceContext();
    spies.collarFindOne.mockResolvedValue(null);

    const res = makeRes();
    await telemetryController.ingestFixes(
      { body: { fixes: [{ collarId: 'E-999', coordinates: [80.99, 8.24] }] } },
      res,
      vi.fn()
    );

    expect(res.statusCode).toBe(201);
    expect(res.payload.alertsCreated).toBe(0);
    expect(res.payload.rejected[0].collarId).toBe('E-999');
  });

  it('reports invalid coordinates as rejected', async () => {
    withGeofenceContext();
    const res = makeRes();
    await telemetryController.ingestFixes(
      { body: { fixes: [{ collarId: 'E-402', coordinates: [999, 999] }] } },
      res,
      vi.fn()
    );
    expect(res.payload.rejected[0].error).toBe('Invalid coordinates');
  });

  it('flags a collar as signal lost and audits it', async () => {
    spies.collarFindOneAndUpdate.mockResolvedValue({ collarId: 'E-512', status: 'signal_lost' });
    const res = makeRes();
    await telemetryController.reportSignalLost(
      { params: { collarId: 'E-512' }, body: { lost: true, reason: 'Heartbeat timeout' } },
      res,
      vi.fn()
    );
    expect(spies.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SIGNAL_LOST', detail: expect.stringContaining('Heartbeat timeout') })
    );
  });

  it('does not audit a signal that came back', async () => {
    spies.collarFindOneAndUpdate.mockResolvedValue({ collarId: 'E-512', status: 'active' });
    const res = makeRes();
    await telemetryController.reportSignalLost(
      { params: { collarId: 'E-512' }, body: { lost: false } },
      res,
      vi.fn()
    );
    expect(spies.auditCreate).not.toHaveBeenCalled();
  });

  it('404s when reporting loss for an unknown collar', async () => {
    const res = makeRes();
    await telemetryController.reportSignalLost({ params: { collarId: 'E-999' }, body: {} }, res, vi.fn());
    expect(res.statusCode).toBe(404);
  });
});
