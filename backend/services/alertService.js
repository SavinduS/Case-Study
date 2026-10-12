const Collar = require('../models/Collar');
const Geofence = require('../models/Geofence');
const Park = require('../models/Park');
const RangerTeam = require('../models/RangerTeam');
const BoundaryAlert = require('../models/BoundaryAlert');
const AuditEntry = require('../models/AuditEntry');
const DispatchAttempt = require('../models/DispatchAttempt');
const { nextSequence } = require('../models/Counter');
const {
  evaluateGeofence,
  findNearestRanger,
  distanceToNearestSettlementM,
  deriveSeverity,
  priorityScore,
  zoneKindLabel
} = require('./geofenceService');
const { isValidLngLat } = require('../utils/geo');
const { deliverDispatch } = require('./notificationService');
const {
  ALERT_STATUS,
  RESPONSE_ACTION,
  COLLAR_STATUS,
  DISPATCH_STATE,
  DISPATCH_MAX_RETRIES,
  FALSE_ALARM_SUPPRESSION_MS,
  AUDIT_ACTION,
  APPROACH_BUFFER_M
} = require('../utils/collarAlertConstants');

const BREACH_DETAIL_TEMPLATE =
  'Asset {collarId} crossed the designated {zoneKind} boundary into a non-protected zone. Immediate action required.';

const OPEN_STATUSES = [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED, ALERT_STATUS.DELAYED];
const HANDLED_STATUSES = [ALERT_STATUS.DISMISSED, ALERT_STATUS.RESOLVED];

/** Allocates the next audit reference. Atomic, like every other reference ID. */
async function nextAuditId() {
  const seq = await nextSequence('auditRef');
  return `AUD-${String(seq).padStart(6, '0')}`;
}

/** Writes one audit trail row. Never throws into the caller's path. */
async function writeAudit({ alertId = null, action, actor, detail, at = new Date() }) {
  return AuditEntry.create({
    auditId: await nextAuditId(),
    alertId,
    action,
    actor,
    detail,
    at
  });
}

/** Reference data needed to evaluate a fix, loaded once per ingest batch. */
async function loadGeofenceContext() {
  const [zones, park] = await Promise.all([
    Geofence.find({ enabled: true }).lean(),
    Park.findOne().lean()
  ]);
  return { zones, settlements: park?.settlements ?? [] };
}

/**
 * The event time of a fix. `undefined` means "live, stamp it now"; anything
 * present must be a real instant, otherwise the caller gets a 400 rather than
 * a misleading incident dated to the moment it was received.
 */
const MAX_FIX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeFixTime(value) {
  if (value === undefined || value === null || value === '') return new Date();
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    throw Object.assign(new Error('at must be a valid ISO-8601 timestamp'), { statusCode: 400 });
  }
  // Collars replay a buffered batch after a dropout, but a timestamp years old
  // is a clock fault rather than telemetry; treat it as stale, not as a breach.
  if (Date.now() - parsed.valueOf() > MAX_FIX_AGE_MS) {
    throw Object.assign(new Error('Fix timestamp is too old to be a real collar reading'), { statusCode: 400 });
  }
  return parsed;
}

/**
 * One alert per breach episode. A collar sitting inside a zone keeps
 * transmitting, so duplicates must be suppressed. A dismissed (false alarm)
 * or resolved alert also suppresses, but only for FALSE_ALARM_SUPPRESSION_MS
 * so the officer is not handed the same false alarm on every fix.
 */
async function shouldRaiseAlert(collarId, zoneId, { now = Date.now(), cooldownMs = FALSE_ALARM_SUPPRESSION_MS } = {}) {
  const existing = await BoundaryAlert.find({ collarId, zoneId }).sort({ detectedAt: -1 }).lean();

  for (const alert of existing) {
    if (OPEN_STATUSES.includes(alert.status)) return false;
    if (HANDLED_STATUSES.includes(alert.status)) {
      const handledAt = alert.handledAt ? new Date(alert.handledAt).getTime() : 0;
      if (now - handledAt < cooldownMs) return false;
    }
  }
  return true;
}

/** Allocates the next unique alert reference ID, e.g. CBA-2026-0007. */
async function nextAlertRef() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`alertRef:${year}`);
  return `CBA-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Evaluates one collar fix and, if it breaches a geofence, persists the alert
 * and its audit entry. Returns the created alert or null.
 *
 * @param {object} fix { collarId, coordinates: [lng, lat], at, delayed }
 */
async function ingestFix(fix, context) {
  const { collarId, coordinates } = fix;

  if (!collarId || typeof collarId !== 'string') {
    throw Object.assign(new Error('collarId is required'), { statusCode: 400 });
  }
  if (!Array.isArray(coordinates) || coordinates.length !== 2 || !isValidLngLat(coordinates[0], coordinates[1])) {
    throw Object.assign(new Error('Invalid coordinates'), { statusCode: 400 });
  }

  // A fix without a usable time cannot be ordered, audited or shown as a breach
  // time, so it is rejected rather than silently recorded as "now".
  const at = normalizeFixTime(fix.at);

  const collar = await Collar.findOne({ collarId });
  if (!collar) {
    throw Object.assign(new Error(`Unknown collar ${collarId}`), { statusCode: 404 });
  }

  const delayed = Boolean(fix.delayed);

  // Persist the fix regardless of whether it breaches: alternate flow A
  // requires standard background tracking to continue uninterrupted.
  collar.lastKnownLocation = { type: 'Point', coordinates };
  collar.lastFixAt = at;
  if (collar.status === COLLAR_STATUS.SIGNAL_LOST) collar.status = COLLAR_STATUS.ACTIVE;
  await collar.save();

  const { zones, settlements } = context;
  const { result } = evaluateGeofence(coordinates, zones, { bufferM: APPROACH_BUFFER_M });
  if (!result) {
    collar.lastZoneId = null;
    return null;
  }

  if (!(await shouldRaiseAlert(collarId, result.zoneId, { now: new Date(at).getTime() }))) {
    collar.lastZoneId = result.zoneId;
    return null;
  }

  const distanceToSettlementM = distanceToNearestSettlementM(coordinates, settlements);
  const threatLevel = deriveSeverity(result, { distanceToSettlementM });
  const details = BREACH_DETAIL_TEMPLATE
    .replace('{collarId}', collarId)
    .replace('{zoneKind}', zoneKindLabel(result.zoneKind));

  collar.lastZoneId = result.zoneId;
  await collar.save();

  const episodeKey = `${collarId}:${result.zoneId}`;

  let alert;
  try {
    alert = await BoundaryAlert.create({
      alertId: await nextAlertRef(),
      episodeKey,
      collarId,
      gpsDeviceId: collar.gpsDeviceId,
      species: collar.species,
      sex: collar.sex,
      health: collar.health,
      speciesRisk: collar.speciesRisk,
      zoneId: result.zoneId,
      zoneName: result.zoneName,
      gridRef: result.gridRef,
      zoneKind: result.zoneKind,
      zoneThreatLevel: result.threatLevel,
      threatLevel,
      position: coordinates,
      depthInsideM: result.depthInsideM,
      distanceToBoundaryM: result.distanceToBoundaryM,
      distanceToSettlementM,
      detectedAt: at,
      status: delayed ? ALERT_STATUS.DELAYED : ALERT_STATUS.ACTIVE,
      delayed,
      details,
      priorityScore: priorityScore({ threatLevel, distanceToSettlementM, speciesRisk: collar.speciesRisk, delayed })
    });
  } catch (error) {
    // Another ingest opened this episode first, or the reference ID collided.
    // Either way no second alert is warranted, so report "no alert".
    if (error.code === 11000) return null;
    throw error;
  }

  await writeAudit({
    alertId: alert.alertId,
    action: delayed ? AUDIT_ACTION.DELAYED_INCIDENT_FLAGGED : AUDIT_ACTION.ALERT_RAISED,
    actor: 'GeofenceEngine',
    detail: delayed
      ? `Retroactive breach reconstructed from batch upload in ${result.zoneName}.`
      : `${collarId} entered ${result.zoneName} (${result.gridRef}).`,
    at
  });

  return alert;
}

/** Ingests a batch of fixes, replaying historical timestamps when delayed. */
async function ingestBatch(fixes, { delayed = false } = {}) {
  const context = await loadGeofenceContext();
  const created = [];
  const rejected = [];

  for (const fix of fixes) {
    try {
      const alert = await ingestFix({ ...fix, delayed: fix.delayed ?? delayed }, context);
      if (alert) created.push(alert);
    } catch (error) {
      rejected.push({ collarId: fix?.collarId ?? null, error: error.message });
    }
  }

  return { created, rejected, zonesConsidered: context.zones.length };
}

/**
 * Sends the dispatch notification to the ranger mobile unit, retrying up to
 * DISPATCH_MAX_RETRIES times (exception flow 3). Every attempt is written to
 * DispatchAttempt, so the officer can see a requested dispatch, the attempts
 * that were delivered, and the ones that failed. On total failure the officer
 * is told to fall back to radio.
 *
 * Attempt numbers continue from what the alert already has, rather than
 * restarting at 1 for each dispatch. An officer may re-task an acknowledged
 * alert, and a log that reads 1,2,3,1,2,3 is ambiguous about which round
 * failed.
 *
 * `deliver` defaults to the real notification channel; tests inject their own.
 */
async function sendDispatch(alert, ranger, { deliver = deliverDispatch } = {}) {
  let lastError = null;
  const alreadyLogged = await DispatchAttempt.countDocuments({ alertId: alert.alertId });
  for (let attempt = 1; attempt <= DISPATCH_MAX_RETRIES; attempt += 1) {
    const sequence = alreadyLogged + attempt;
    let ok = false;
    try {
      ok = (await deliver({ alert, ranger, attempt: sequence })) === true;
    } catch (error) {
      ok = false;
      lastError = error;
    }
    await DispatchAttempt.create({
      alertId: alert.alertId,
      rangerId: ranger?.rangerId ?? null,
      rangerName: ranger?.name ?? null,
      attempt: sequence,
      // A failed attempt stays 'sending' while the loop retries; the whole set
      // is flipped to 'failed' below if none of them lands.
      state: ok ? DISPATCH_STATE.DELIVERED : DISPATCH_STATE.SENDING,
      error: ok ? null : 'Ranger mobile unit unreachable'
    });
    if (ok) return { delivered: true, attempts: sequence };
  }

  await DispatchAttempt.updateMany(
    { alertId: alert.alertId, attempt: { $gt: alreadyLogged } },
    { $set: { state: DISPATCH_STATE.FAILED } }
  );
  return {
    delivered: false,
    attempts: alreadyLogged + DISPATCH_MAX_RETRIES,
    error: lastError?.message ?? 'Ranger mobile unit unreachable',
    fallback: 'Contact the ranger team by radio.'
  };
}

/**
 * Shared officer-response logic. `action` is one of the RESPONSE_ACTION
 * values; every path writes an audit entry and returns the updated alert.
 */
async function respondToAlert(alertId, action, { actor = 'officer', notes = null, deliver } = {}) {
  const alert = await BoundaryAlert.findOne({ alertId });
  if (!alert) throw Object.assign(new Error('Alert not found'), { statusCode: 404 });

  // An officer who dismissed or resolved an incident must not be able to
  // re-open it with a second click, and the status must never move backwards
  // out of a terminal state.
  if (HANDLED_STATUSES.includes(alert.status)) {
    throw Object.assign(
      new Error(`Alert ${alertId} is already ${alert.status} and cannot be actioned again`),
      { statusCode: 409 }
    );
  }

  const handled = { handledBy: actor, handledAt: new Date(), responseAction: action };
  let audit;
  let patch = {};

  switch (action) {
    case RESPONSE_ACTION.ACKNOWLEDGE_DISPATCH: {
      const rangers = await RangerTeam.find().lean();
      const ranger = findNearestRanger(alert.position, rangers);

      patch = {
        ...handled,
        status: ALERT_STATUS.ACKNOWLEDGED,
        dispatchState: DISPATCH_STATE.SENDING
      };
      audit = {
        action: AUDIT_ACTION.ALERT_ACKNOWLEDGED,
        actor,
        detail: `Alert ${alertId} acknowledged by ${actor}.`
      };

      Object.assign(alert, patch);
      await alert.save();
      await writeAudit({ alertId, ...audit });

      const outcome = await sendDispatch(alert.toObject(), ranger, { deliver });

      alert.dispatchState = outcome.delivered ? DISPATCH_STATE.DELIVERED : DISPATCH_STATE.FAILED;
      alert.dispatchAttempts = outcome.attempts;
      alert.dispatchedTo = outcome.delivered ? (ranger?.name ?? null) : null;
      alert.dispatchedRangerId = outcome.delivered ? (ranger?.rangerId ?? null) : null;
      await alert.save();

      if (outcome.delivered && ranger) {
        await RangerTeam.updateOne({ rangerId: ranger.rangerId }, { $set: { status: 'dispatched' } });
      }

      await writeAudit({
        alertId,
        action: outcome.delivered ? AUDIT_ACTION.RANGER_DISPATCHED : AUDIT_ACTION.DISPATCH_FAILED,
        actor: 'NotificationService',
        detail: outcome.delivered
          ? `${ranger?.name ?? 'Nearest ranger team'} notified after ${outcome.attempts} attempt(s).`
          : `Dispatch failed after ${outcome.attempts} retries. Contact the ranger team by radio.`
      });

      return { alert, dispatch: outcome, ranger };
    }

    case RESPONSE_ACTION.MONITOR_CLOSELY:
      // The officer is tracking it, so the episode stays open and no new
      // alert is raised while they watch.
      patch = { ...handled, status: ALERT_STATUS.ACKNOWLEDGED };
      audit = { action: AUDIT_ACTION.MONITOR_CLOSELY, detail: 'Officer elected to monitor the animal closely without dispatch.' };
      break;

    case RESPONSE_ACTION.MARK_FALSE_ALARM:
      // Alternate flow C. The officer note is the evidence that the breach
      // was collar signal drift, so it is required.
      if (!notes || !notes.trim()) {
        throw Object.assign(new Error('Notes are required to mark an alert as a false alarm'), { statusCode: 400 });
      }
      patch = { ...handled, status: ALERT_STATUS.DISMISSED, notes: notes.trim(), episodeKey: null };
      audit = { action: AUDIT_ACTION.MARKED_FALSE_ALARM, detail: notes.trim() };
      break;

    case RESPONSE_ACTION.DISPATCH_PATCH_CHECK: {
      // Alternate flow D: a retroactive breach the officer has accepted.
      const rangers = await RangerTeam.find().lean();
      const ranger = findNearestRanger(alert.position, rangers);

      patch = { ...handled, status: ALERT_STATUS.ACKNOWLEDGED, dispatchState: DISPATCH_STATE.SENDING };
      Object.assign(alert, patch);
      await alert.save();
      await writeAudit({
        alertId,
        action: AUDIT_ACTION.PATROL_CHECK_DISPATCHED,
        actor,
        detail: 'Delayed incident accepted; retroactive patrol check dispatched.'
      });

      const outcome = await sendDispatch(alert.toObject(), ranger, { deliver });
      alert.dispatchState = outcome.delivered ? DISPATCH_STATE.DELIVERED : DISPATCH_STATE.FAILED;
      alert.dispatchAttempts = outcome.attempts;
      alert.dispatchedTo = outcome.delivered ? (ranger?.name ?? null) : null;
      alert.dispatchedRangerId = outcome.delivered ? (ranger?.rangerId ?? null) : null;
      await alert.save();

      if (outcome.delivered && ranger) {
        await RangerTeam.updateOne({ rangerId: ranger.rangerId }, { $set: { status: 'dispatched' } });
      }

      await writeAudit({
        alertId,
        action: outcome.delivered ? AUDIT_ACTION.RANGER_DISPATCHED : AUDIT_ACTION.DISPATCH_FAILED,
        actor: 'NotificationService',
        detail: outcome.delivered
          ? `${ranger?.name ?? 'Ranger team'} notified to run a patrol check.`
          : `Dispatch failed after ${DISPATCH_MAX_RETRIES} retries. Contact the ranger team by radio.`
      });

      return { alert, dispatch: outcome, ranger };
    }

    default:
      throw Object.assign(new Error(`Unsupported response action ${action}`), { statusCode: 400 });
  }

  Object.assign(alert, patch);
  await alert.save();
  await writeAudit({ alertId, actor, ...audit });
  return { alert, dispatch: null, ranger: null };
}

/** Alerts ordered for the operations officer, highest priority first. */
function listAlerts({ status, includeHandled = false, limit = 100 } = {}) {
  const filter = {};
  if (status) {
    filter.status = Array.isArray(status) ? { $in: status } : status;
  } else if (!includeHandled) {
    filter.status = { $in: OPEN_STATUSES };
  }
  return BoundaryAlert.find(filter).sort({ priorityScore: -1, detectedAt: -1 }).limit(limit).lean();
}

module.exports = {
  ingestFix,
  ingestBatch,
  loadGeofenceContext,
  shouldRaiseAlert,
  respondToAlert,
  sendDispatch,
  listAlerts,
  writeAudit,
  nextAlertRef,
  normalizeFixTime,
  OPEN_STATUSES,
  HANDLED_STATUSES
};