import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';

/**
 * alertService reaches MongoDB through model modules. Rather than rely on
 * module-mock hoisting, each model's static methods are swapped for spies and
 * restored afterwards. The service holds the same cached module objects, so
 * it sees the replacements and no real query is ever issued.
 */

const models = {
  Collar: require('../models/Collar'),
  BoundaryAlert: require('../models/BoundaryAlert'),
  AuditEntry: require('../models/AuditEntry'),
  RangerTeam: require('../models/RangerTeam'),
  Park: require('../models/Park'),
  DispatchAttempt: require('../models/DispatchAttempt'),
  Counter: require('../models/Counter'),
  Geofence: require('../models/Geofence')
};

const originals = {};
for (const [name, model] of Object.entries(models)) {
  originals[name] = { ...model };
}

const hoisted = {
  collarFindOne: vi.fn(),
  collarSave: vi.fn(),
  alertFind: vi.fn(),
  alertCreate: vi.fn(),
  alertFindOne: vi.fn(),
  alertFindOneAndUpdate: vi.fn(),
  auditCreate: vi.fn(),
  rangerFind: vi.fn(),
  rangerUpdateOne: vi.fn(),
  parkFindOne: vi.fn(),
  attemptCreate: vi.fn(),
  attemptUpdateMany: vi.fn(),
  geofenceFind: vi.fn(),
  nextSequence: vi.fn()
};

Object.assign(models.Collar, { findOne: hoisted.collarFindOne });
Object.assign(models.BoundaryAlert, {
  find: hoisted.alertFind,
  create: hoisted.alertCreate,
  findOne: hoisted.alertFindOne,
  findOneAndUpdate: hoisted.alertFindOneAndUpdate
});
Object.assign(models.AuditEntry, { create: hoisted.auditCreate });
Object.assign(models.RangerTeam, { find: hoisted.rangerFind, updateOne: hoisted.rangerUpdateOne });
Object.assign(models.Park, { findOne: hoisted.parkFindOne });
Object.assign(models.DispatchAttempt, { create: hoisted.attemptCreate, updateMany: hoisted.attemptUpdateMany });
Object.assign(models.Counter, { nextSequence: hoisted.nextSequence });
Object.assign(models.Geofence, { find: hoisted.geofenceFind });

afterAll(() => {
  for (const [name, model] of Object.entries(models)) {
    for (const key of Object.keys(originals[name])) {
      if (originals[name][key] !== undefined) model[key] = originals[name][key];
    }
  }
});

const alertService = require('../services/alertService');
const { ALERT_STATUS, THREAT_LEVEL, AUDIT_ACTION, DISPATCH_STATE } = require('../utils/collarAlertConstants');

const ZONE = {
  zoneId: 'Z1',
  name: 'Elephant Corridor - Western Farmland',
  gridRef: 'G7',
  kind: 'farmland',
  threatLevel: THREAT_LEVEL.CRITICAL,
  settlementIds: ['S1'],
  polygon: [
    [81.03, 8.196], [81.005, 8.205], [80.972, 8.228], [80.952, 8.262],
    [80.968, 8.292], [81.008, 8.288], [81.034, 8.258], [81.038, 8.222],
    [81.03, 8.196]
  ]
};

/** A context whose single zone is Z1, matching the seeded park. */
const CONTEXT = { zones: [ZONE], settlements: [{ settlementId: 'S1', name: 'Kiri Veedi', position: [80.958, 8.156] }] };

function makeCollar(overrides = {}) {
  return {
    collarId: 'E-402',
    gpsDeviceId: 'GPS-8841',
    species: 'African Elephant',
    sex: 'Female',
    health: 'Stable',
    speciesRisk: 'high',
    status: 'active',
    lastZoneId: null,
    lastKnownLocation: { type: 'Point', coordinates: [81.06, 8.24] },
    save: hoisted.collarSave,
    ...overrides
  };
}

/** Chains .sort().lean() the way Mongoose queries do. */
function leanChain(result) {
  return { sort: () => ({ lean: () => Promise.resolve(result) }) };
}

/** Chains a bare .lean() for the queries that do not sort. */
function plainLean(result) {
  return { lean: () => Promise.resolve(result) };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.geofenceFind.mockReturnValue(plainLean([]));
  hoisted.parkFindOne.mockReturnValue(plainLean({ parkId: 'KNP', settlements: [] }));
  hoisted.rangerFind.mockResolvedValue([]);
  hoisted.rangerUpdateOne.mockResolvedValue({});
  hoisted.nextSequence.mockResolvedValue(42);
  hoisted.auditCreate.mockResolvedValue({});
  hoisted.attemptCreate.mockResolvedValue({});
  hoisted.attemptUpdateMany.mockResolvedValue({});
  hoisted.alertCreate.mockImplementation((doc) => Promise.resolve(doc));
  hoisted.collarSave.mockResolvedValue(undefined);
});

describe('loadGeofenceContext', () => {
  it('loads enabled geofences and the park settlements', async () => {
    hoisted.geofenceFind.mockReturnValue(plainLean([ZONE]));
    hoisted.parkFindOne.mockReturnValue(plainLean({ parkId: 'KNP', settlements: CONTEXT.settlements }));

    const context = await alertService.loadGeofenceContext();

    expect(hoisted.geofenceFind).toHaveBeenCalledWith({ enabled: true });
    expect(context.zones).toHaveLength(1);
    expect(context.settlements).toHaveLength(1);
  });

  it('tolerates a park with no settlements', async () => {
    hoisted.geofenceFind.mockReturnValue(plainLean([ZONE]));
    hoisted.parkFindOne.mockReturnValue(plainLean({ parkId: 'KNP' }));

    const context = await alertService.loadGeofenceContext();
    expect(context.settlements).toEqual([]);
  });
});

describe('nextAlertRef', () => {
  it('formats a zero-padded reference for the current year', async () => {
    hoisted.nextSequence.mockResolvedValue(7);
    const ref = await alertService.nextAlertRef();
    expect(ref).toBe(`CBA-${new Date().getFullYear()}-0007`);
  });

  it('does not truncate a large sequence', async () => {
    hoisted.nextSequence.mockResolvedValue(12345);
    expect(await alertService.nextAlertRef()).toMatch(/CBA-\d{4}-12345$/);
  });
});

describe('shouldRaiseAlert', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');

  it('raises when there is no history for the breach', async () => {
    hoisted.alertFind.mockReturnValue(leanChain([]));
    expect(await alertService.shouldRaiseAlert('E-402', 'Z1')).toBe(true);
  });

  it('suppresses while an open alert exists', async () => {
    for (const status of [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED, ALERT_STATUS.DELAYED]) {
      hoisted.alertFind.mockReturnValue(leanChain([{ status, handledAt: null }]));
      expect(await alertService.shouldRaiseAlert('E-402', 'Z1', { now })).toBe(false);
    }
  });

  it('suppresses a false alarm inside the cooldown window', async () => {
    hoisted.alertFind.mockReturnValue(leanChain([
      { status: ALERT_STATUS.DISMISSED, handledAt: new Date(now - 60_000) }
    ]));
    expect(await alertService.shouldRaiseAlert('E-402', 'Z1', { now })).toBe(false);
  });

  it('raises again once the cooldown has lapsed', async () => {
    hoisted.alertFind.mockReturnValue(leanChain([
      { status: ALERT_STATUS.DISMISSED, handledAt: new Date(now - 16 * 60_000) }
    ]));
    expect(await alertService.shouldRaiseAlert('E-402', 'Z1', { now })).toBe(true);
  });

  it('honours a custom cooldown length', async () => {
    hoisted.alertFind.mockReturnValue(leanChain([
      { status: ALERT_STATUS.DISMISSED, handledAt: new Date(now - 60_000) }
    ]));
    expect(await alertService.shouldRaiseAlert('E-402', 'Z1', { now, cooldownMs: 0 })).toBe(true);
  });

  it('asks the database only about that collar and zone', async () => {
    // Filtering is delegated to the query rather than re-filtered in JS.
    hoisted.alertFind.mockReturnValue(leanChain([]));
    await alertService.shouldRaiseAlert('E-402', 'Z1');
    expect(hoisted.alertFind).toHaveBeenCalledWith({ collarId: 'E-402', zoneId: 'Z1' });
  });

  it('returns only the most recent alerts, newest first', async () => {
    const sort = vi.fn(() => ({ lean: () => Promise.resolve([]) }));
    hoisted.alertFind.mockReturnValue({ sort });
    await alertService.shouldRaiseAlert('E-402', 'Z1');
    expect(sort).toHaveBeenCalledWith({ detectedAt: -1 });
  });
});

describe('ingestFix', () => {
  const insideZone = [80.99, 8.24];

  it('persists the fix and raises an alert for a breach', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));

    const alert = await alertService.ingestFix({ collarId: 'E-402', coordinates: insideZone }, CONTEXT);

    expect(hoisted.collarSave).toHaveBeenCalled();
    expect(alert).not.toBeNull();
    expect(alert.collarId).toBe('E-402');
    expect(alert.zoneId).toBe('Z1');
    expect(alert.status).toBe(ALERT_STATUS.ACTIVE);
    expect(alert.gridRef).toBe('G7');
    expect(alert.detectedAt).toBeInstanceOf(Date);
    expect(alert.details).toContain('E-402');
    expect(alert.details).toContain('farmland');
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.ALERT_RAISED, actor: 'GeofenceEngine' })
    );
  });

  it('stores the fix and clears the zone but raises nothing when safe', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());

    const alert = await alertService.ingestFix({ collarId: 'E-402', coordinates: [81.09, 8.19] }, CONTEXT);

    expect(alert).toBeNull();
    expect(hoisted.alertCreate).not.toHaveBeenCalled();
    expect(hoisted.collarSave).toHaveBeenCalled();
  });

  it('flags a replayed historical fix as a delayed incident', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));

    const at = new Date('2026-10-09T12:50:00Z');
    const alert = await alertService.ingestFix(
      { collarId: 'E-331', coordinates: insideZone, at, delayed: true },
      CONTEXT
    );

    expect(alert.status).toBe(ALERT_STATUS.DELAYED);
    expect(alert.delayed).toBe(true);
    expect(alert.detectedAt).toEqual(at);
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.DELAYED_INCIDENT_FLAGGED })
    );
  });

  it('does not raise a second alert for the same open episode', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([{ status: ALERT_STATUS.ACTIVE, handledAt: null }]));

    expect(await alertService.ingestFix({ collarId: 'E-402', coordinates: insideZone }, CONTEXT)).toBeNull();
    expect(hoisted.alertCreate).not.toHaveBeenCalled();
  });

  it('treats a duplicate key error as "already open" rather than failing', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));
    const duplicate = Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
    hoisted.alertCreate.mockRejectedValue(duplicate);

    // Two concurrent ingests race; the unique episodeKey index lets only
    // one through, and the loser must not surface as an error.
    expect(await alertService.ingestFix({ collarId: 'E-402', coordinates: insideZone }, CONTEXT)).toBeNull();
  });

  it('rethrows a genuine database failure', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));
    hoisted.alertCreate.mockRejectedValue(new Error('disk full'));

    await expect(alertService.ingestFix({ collarId: 'E-402', coordinates: insideZone }, CONTEXT))
      .rejects.toThrow('disk full');
  });

  it('restores a collar that was flagged signal lost', async () => {
    const collar = makeCollar({ status: 'signal_lost' });
    hoisted.collarFindOne.mockResolvedValue(collar);

    await alertService.ingestFix({ collarId: 'E-402', coordinates: [81.09, 8.19] }, CONTEXT);
    expect(collar.status).toBe('active');
  });

  it('records the offending zone on the collar even when suppressed', async () => {
    const collar = makeCollar();
    hoisted.collarFindOne.mockResolvedValue(collar);
    hoisted.alertFind.mockReturnValue(leanChain([{ status: ALERT_STATUS.ACTIVE, handledAt: null }]));

    await alertService.ingestFix({ collarId: 'E-402', coordinates: insideZone }, CONTEXT);
    expect(collar.lastZoneId).toBe('Z1');
  });

  it.each([
    ['missing coordinates', { collarId: 'E-402' }],
    ['wrong arity', { collarId: 'E-402', coordinates: [81.0] }],
    ['out of range', { collarId: 'E-402', coordinates: [999, 999] }],
    ['non-numeric', { collarId: 'E-402', coordinates: ['81.0', '8.2'] }]
  ])('rejects %s with a 400', async (_label, fix) => {
    await expect(alertService.ingestFix(fix, CONTEXT)).rejects.toMatchObject({ statusCode: 400 });
    expect(hoisted.collarFindOne).not.toHaveBeenCalled();
  });

  it('rejects a fix for an unknown collar with a 404', async () => {
    hoisted.collarFindOne.mockResolvedValue(null);
    await expect(alertService.ingestFix({ collarId: 'E-999', coordinates: insideZone }, CONTEXT))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('ingestBatch', () => {
  beforeEach(() => {
    // ingestBatch loads its own context, so the zone has to come from here.
    hoisted.geofenceFind.mockReturnValue(plainLean([ZONE]));
    hoisted.parkFindOne.mockReturnValue(plainLean({ parkId: 'KNP', settlements: CONTEXT.settlements }));
  });

  it('returns the alerts a batch created', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));
    hoisted.nextSequence.mockResolvedValue(1);

    const result = await alertService.ingestBatch([{ collarId: 'E-402', coordinates: [80.99, 8.24] }]);

    expect(result.created).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.zonesConsidered).toBe(1);
  });

  it('keeps going when one fix in a batch is bad', async () => {
    hoisted.collarFindOne.mockImplementation((query) =>
      (query.collarId === 'E-999' ? Promise.resolve(null) : Promise.resolve(makeCollar()))
    );
    hoisted.alertFind.mockReturnValue(leanChain([]));

    const result = await alertService.ingestBatch([
      { collarId: 'E-999', coordinates: [80.99, 8.24] },
      { collarId: 'E-402', coordinates: [80.99, 8.24] }
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.rejected).toEqual([{ collarId: 'E-999', error: 'Unknown collar E-999' }]);
  });

  it('propagates the delayed flag to every fix in the batch', async () => {
    hoisted.collarFindOne.mockResolvedValue(makeCollar());
    hoisted.alertFind.mockReturnValue(leanChain([]));

    const result = await alertService.ingestBatch(
      [{ collarId: 'E-331', coordinates: [80.99, 8.24] }],
      { delayed: true }
    );
    expect(result.created[0].status).toBe(ALERT_STATUS.DELAYED);
  });

  it('creates no alert for an empty batch', async () => {
    const result = await alertService.ingestBatch([]);
    expect(result.created).toHaveLength(0);
  });
});

describe('sendDispatch', () => {
  const alert = { alertId: 'CBA-2026-0001' };
  const ranger = { rangerId: 'RT-02', name: 'Ranger Team Matale' };

  it('stops at the first successful attempt', async () => {
    const deliver = vi.fn().mockResolvedValue(true);
    const outcome = await alertService.sendDispatch(alert, ranger, { deliver });

    expect(outcome).toEqual({ delivered: true, attempts: 1 });
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(hoisted.attemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({ attempt: 1, state: DISPATCH_STATE.DELIVERED })
    );
  });

  it('retries up to three times before giving up (exception flow 3)', async () => {
    const deliver = vi.fn().mockResolvedValue(false);
    const outcome = await alertService.sendDispatch(alert, ranger, { deliver });

    expect(outcome.delivered).toBe(false);
    expect(outcome.attempts).toBe(3);
    expect(deliver).toHaveBeenCalledTimes(3);
    expect(hoisted.attemptUpdateMany).toHaveBeenCalledWith(
      { alertId: alert.alertId },
      { $set: { state: DISPATCH_STATE.FAILED } }
    );
  });

  it('succeeds on a later retry', async () => {
    const deliver = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const outcome = await alertService.sendDispatch(alert, ranger, { deliver });

    expect(outcome).toEqual({ delivered: true, attempts: 3 });
  });

  it('records the ranger on every attempt', async () => {
    await alertService.sendDispatch(alert, ranger, { deliver: vi.fn().mockResolvedValue(false) });
    expect(hoisted.attemptCreate).toHaveBeenCalledWith(
      expect.objectContaining({ rangerId: 'RT-02', rangerName: 'Ranger Team Matale' })
    );
  });

  it('copes with no available ranger', async () => {
    const outcome = await alertService.sendDispatch(alert, null, { deliver: vi.fn().mockResolvedValue(true) });
    expect(outcome.delivered).toBe(true);
    expect(hoisted.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({ rangerId: null }));
  });
});

describe('respondToAlert', () => {
  const existing = () => ({
    alertId: 'CBA-2026-0001',
    position: [80.99, 8.24],
    status: ALERT_STATUS.ACTIVE,
    save: vi.fn().mockResolvedValue(undefined),
    toObject() {
      return { alertId: this.alertId, position: this.position };
    }
  });

  beforeEach(() => {
    hoisted.rangerFind.mockReturnValue(plainLean([
      { rangerId: 'RT-01', name: 'Ranger Team Kandy', status: 'available', position: [81.021, 8.191] }
    ]));
  });

  it('releases the dispatched team so it is not sent twice', async () => {
    hoisted.alertFindOne.mockResolvedValue(existing());
    await alertService.respondToAlert('CBA-2026-0001', 'acknowledge_dispatch', {
      deliver: vi.fn().mockResolvedValue(true)
    });
    expect(hoisted.rangerUpdateOne).toHaveBeenCalledWith(
      { rangerId: 'RT-01' },
      { $set: { status: 'dispatched' } }
    );
  });

  it('acknowledges and dispatches the nearest team', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);

    const { alert: updated, dispatch, ranger } = await alertService.respondToAlert(
      'CBA-2026-0001',
      'acknowledge_dispatch',
      { actor: 'OF-021', deliver: vi.fn().mockResolvedValue(true) }
    );

    expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(updated.handledBy).toBe('OF-021');
    expect(updated.dispatchedTo).toBe('Ranger Team Kandy');
    expect(updated.dispatchState).toBe(DISPATCH_STATE.DELIVERED);
    expect(dispatch.delivered).toBe(true);
    expect(ranger.rangerId).toBe('RT-01');
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.ALERT_ACKNOWLEDGED, actor: 'OF-021' })
    );
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.RANGER_DISPATCHED })
    );
  });

  it('records a failed dispatch and still acknowledges', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);

    const { alert: updated } = await alertService.respondToAlert(
      'CBA-2026-0001',
      'acknowledge_dispatch',
      { deliver: vi.fn().mockResolvedValue(false) }
    );

    expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(updated.dispatchState).toBe(DISPATCH_STATE.FAILED);
    expect(updated.dispatchedTo).toBeNull();
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.DISPATCH_FAILED })
    );
  });

  it('keeps an alert open when the officer only monitors it', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);

    const { alert: updated, dispatch } = await alertService.respondToAlert(
      'CBA-2026-0001',
      'monitor_closely',
      { actor: 'OF-021' }
    );

    expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(updated.handledBy).toBe('OF-021');
    expect(dispatch).toBeNull();
    expect(hoisted.rangerFind).not.toHaveBeenCalled();
  });

  it('dismisses a false alarm with the officer note and frees the episode', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);

    const { alert: updated } = await alertService.respondToAlert(
      'CBA-2026-0001',
      'mark_false_alarm',
      { notes: '  Collar signal drift.  ' }
    );

    expect(updated.status).toBe(ALERT_STATUS.DISMISSED);
    expect(updated.notes).toBe('Collar signal drift.');
    // The episode key must be released so a later genuine breach can alert.
    expect(updated.episodeKey).toBeNull();
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.MARKED_FALSE_ALARM, detail: 'Collar signal drift.' })
    );
  });

  it.each([
    ['no notes', undefined],
    ['empty notes', ''],
    ['whitespace only', '   ']
  ])('refuses a false alarm with %s', async (_label, notes) => {
    hoisted.alertFindOne.mockResolvedValue(existing());
    await expect(
      alertService.respondToAlert('CBA-2026-0001', 'mark_false_alarm', { notes })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('dispatches a patrol check for a delayed incident', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);

    const { alert: updated } = await alertService.respondToAlert(
      'CBA-2026-0001',
      'dispatch_patch_check',
      { actor: 'OF-021', deliver: vi.fn().mockResolvedValue(true) }
    );

    expect(updated.status).toBe(ALERT_STATUS.ACKNOWLEDGED);
    expect(updated.dispatchedTo).toBe('Ranger Team Kandy');
    expect(hoisted.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ action: AUDIT_ACTION.PATROL_CHECK_DISPATCHED })
    );
  });

  it('rejects an unsupported action with a 400', async () => {
    hoisted.alertFindOne.mockResolvedValue(existing());
    await expect(alertService.respondToAlert('CBA-2026-0001', 'launch_missiles'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('returns 404 for an alert that does not exist', async () => {
    hoisted.alertFindOne.mockResolvedValue(null);
    await expect(alertService.respondToAlert('CBA-9999-9999', 'monitor_closely'))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  it('defaults the actor when the caller does not supply one', async () => {
    const alert = existing();
    hoisted.alertFindOne.mockResolvedValue(alert);
    await alertService.respondToAlert('CBA-2026-0001', 'monitor_closely');
    expect(alert.handledBy).toBe('officer');
  });
});

describe('listAlerts', () => {
  beforeEach(() => {
    hoisted.alertFind.mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) })
    });
  });

  it('filters to open statuses by default', () => {
    alertService.listAlerts();
    expect(hoisted.alertFind).toHaveBeenCalledWith(
      expect.objectContaining({ status: { $in: alertService.OPEN_STATUSES } })
    );
  });

  it('can include handled alerts', () => {
    alertService.listAlerts({ includeHandled: true });
    expect(hoisted.alertFind).toHaveBeenCalledWith({});
  });

  it('accepts a single status as a plain equality filter', () => {
    alertService.listAlerts({ status: ALERT_STATUS.DELAYED });
    expect(hoisted.alertFind).toHaveBeenCalledWith({ status: ALERT_STATUS.DELAYED });
  });

  it('accepts an explicit status list', () => {
    // An array of statuses is passed through as a Mongo $in filter.
    alertService.listAlerts({ status: [ALERT_STATUS.DISMISSED] });
    expect(hoisted.alertFind).toHaveBeenCalledWith({
      status: { $in: [ALERT_STATUS.DISMISSED] }
    });
  });
});
