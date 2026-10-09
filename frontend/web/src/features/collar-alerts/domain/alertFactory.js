import { ALERT_STATUS } from './constants.js';
import { distanceToNearestSettlementM } from './geofenceEngine.js';
import { BREACH_DETAIL_TEMPLATE, SETTLEMENTS } from '../data/parkData.js';

let sequence = 0;

/** Unique alert reference ID, e.g. CBA-2026-0007 (main flow, step 10). */
export function nextAlertRef(now = new Date()) {
  sequence += 1;
  return `CBA-${now.getFullYear()}-${String(sequence).padStart(4, '0')}`;
}

export function resetAlertSequence(value = 0) {
  sequence = value;
}

/** Human label for a geofence zone kind, used in the alert narrative. */
function zoneKindLabel(kind) {
  switch (kind) {
    case 'farmland':
      return 'farmland';
    case 'village':
      return 'village';
    case 'road':
      return 'road';
    default:
      return 'high-risk';
  }
}

/**
 * Builds the alert record persisted against WildlifeDB.saveAlertRecord().
 * `delayed` marks retroactive breaches reconstructed from a batch upload
 * (alternate flow D).
 */
export function createBoundaryAlert({
  collar,
  result,
  detectedAt,
  severity,
  delayed = false,
  settlements = SETTLEMENTS
}) {
  const distanceToSettlementM = distanceToNearestSettlementM(collar.position, settlements);
  const detail = BREACH_DETAIL_TEMPLATE.replace('{collarId}', collar.collarId).replace(
    '{zoneKind}',
    zoneKindLabel(result.zoneKind)
  );

  return {
    alertId: nextAlertRef(new Date(detectedAt)),
    collarId: collar.collarId,
    gpsDeviceId: collar.gpsDeviceId,
    species: collar.species,
    sex: collar.sex,
    health: collar.health,
    speciesRisk: collar.speciesRisk,
    position: collar.position,
    zoneId: result.zoneId,
    zoneName: result.zoneName,
    gridRef: result.gridRef,
    threatLevel: severity,
    zoneThreatLevel: result.threatLevel,
    depthInsideM: result.depthInsideM,
    distanceToBoundaryM: result.distanceToBoundaryM,
    distanceToSettlementM,
    detectedAt,
    status: delayed ? ALERT_STATUS.DELAYED : ALERT_STATUS.ACTIVE,
    delayed,
    details: detail,
    notes: null,
    handledBy: null,
    handledAt: null,
    dispatchedTo: null,
    dispatchAttempts: 0,
    dispatchState: 'idle'
  };
}

/** Audit trail entry written for every officer or system action. */
export function createAuditEntry({ action, alert, actor, detail, at = new Date() }) {
  return {
    auditId: `AUD-${at.getTime()}-${Math.floor(Math.random() * 1000)}`,
    alertId: alert?.alertId ?? null,
    action,
    actor,
    detail,
    at
  };
}

export const AUDIT_ACTION = {
  ALERT_RAISED: 'ALERT_RAISED',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  MONITOR_CLOSELY: 'MONITOR_CLOSELY',
  MARKED_FALSE_ALARM: 'MARKED_FALSE_ALARM',
  DELAYED_INCIDENT_FLAGGED: 'DELAYED_INCIDENT_FLAGGED',
  PATROL_CHECK_DISPATCHED: 'PATROL_CHECK_DISPATCHED',
  RANGER_DISPATCHED: 'RANGER_DISPATCHED',
  DISPATCH_FAILED: 'DISPATCH_FAILED',
  SIGNAL_LOST: 'SIGNAL_LOST'
};