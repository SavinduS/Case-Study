import {
  pointInPolygon,
  distanceToPolygonMeters,
  haversineDistanceMeters
} from './geo.js';
import {
  THREAT_LEVEL,
  SEVERITY_WEIGHT,
  PROXIMITY_WEIGHT_PER_KM,
  ALERT_STATUS,
  FALSE_ALARM_SUPPRESSION_MS
} from './constants.js';

const THREAT_RANK = {
  [THREAT_LEVEL.CRITICAL]: 4,
  [THREAT_LEVEL.HIGH]: 3,
  [THREAT_LEVEL.MEDIUM]: 2,
  [THREAT_LEVEL.LOW]: 1
};

/**
 * GeofenceEngine.evaluateZone — tests one coordinate against one zone.
 *
 * Returns a GeofenceResult. `breached` is true when the fix sits inside the
 * zone, or inside the pre-alert buffer that represents "approaching" the
 * boundary described in the main flow (step 3).
 */
export function evaluateZone([lng, lat], zone, bufferM = 0) {
  const coordinates = [lng, lat];
  const distanceM = distanceToPolygonMeters(coordinates, zone.polygon);
  const inside = pointInPolygon(coordinates, zone.polygon);
  const depthInsideM = inside ? distanceM : 0;

  return {
    zoneId: zone.zoneId,
    zoneName: zone.name,
    threatLevel: zone.threatLevel,
    gridRef: zone.gridRef,
    zoneKind: zone.kind,
    breached: inside || distanceM <= bufferM,
    isInside: inside,
    approaching: !inside && distanceM <= bufferM,
    distanceToBoundaryM: Math.round(distanceM),
    depthInsideM: Math.round(depthInsideM)
  };
}

/**
 * GeofenceEngine.evaluateGeofencing — evaluates a fix against every zone
 * and returns the single most severe breach, or a safe result.
 */
export function evaluateGeofence(coordinates, zones, { bufferM = 0 } = {}) {
  const results = zones.map((zone) => evaluateZone(coordinates, zone, bufferM));
  const breached = results
    .filter((result) => result.breached)
    .sort(
      (a, b) =>
        THREAT_RANK[b.threatLevel] - THREAT_RANK[a.threatLevel] ||
        b.distanceToBoundaryM - a.distanceToBoundaryM
    );

  if (breached.length === 0) {
    return { safe: true, result: null, all: results };
  }
  return { safe: false, result: breached[0], all: results };
}

/**
 * GeofenceEngine.findNearestRanger — nearest available ranger team to a
 * breach point, used when a dispatch is confirmed.
 */
export function findNearestRanger(coordinates, rangers) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const ranger of rangers) {
    if (ranger.status !== 'available') continue;
    const distanceM = haversineDistanceMeters(coordinates, ranger.position);
    if (distanceM < nearestDistance) {
      nearestDistance = distanceM;
      nearest = { ...ranger, distanceM: Math.round(distanceM) };
    }
  }
  return nearest;
}

/** Nearest human settlement to a breach point, in metres. */
export function distanceToNearestSettlementM(coordinates, settlements) {
  let nearest = Infinity;
  for (const settlement of settlements) {
    nearest = Math.min(nearest, haversineDistanceMeters(coordinates, settlement.position));
  }
  return Math.round(nearest);
}

/**
 * Threat level raised for a breach. Severity is monotonic in how far the
 * animal has travelled past the boundary, so an alert can only escalate
 * as the breach deepens:
 *
 *   approaching  -> the zone's own threat level
 *   inside       -> at least HIGH
 *   deep inside  -> one step above the zone level, capped at CRITICAL
 *   near a settlement -> escalates a HIGH or CRITICAL zone to CRITICAL
 */
export function deriveSeverity(
  result,
  { distanceToSettlementM = Infinity, depthThresholdM = 500 } = {}
) {
  if (!result) return THREAT_LEVEL.LOW;

  const nearSettlement = distanceToSettlementM <= 1_500;
  const base = THREAT_RANK[result.threatLevel] ?? THREAT_RANK[THREAT_LEVEL.LOW];

  let rank = base;
  if (result.isInside) rank = Math.max(rank, THREAT_RANK[THREAT_LEVEL.HIGH]);
  if (result.depthInsideM >= depthThresholdM) {
    rank = Math.min(THREAT_RANK[THREAT_LEVEL.CRITICAL], rank + 1);
  }
  if (nearSettlement && base >= THREAT_RANK[THREAT_LEVEL.HIGH]) {
    rank = THREAT_RANK[THREAT_LEVEL.CRITICAL];
  }

  return RANK_TO_THREAT[rank];
}

const RANK_TO_THREAT = {
  1: THREAT_LEVEL.LOW,
  2: THREAT_LEVEL.MEDIUM,
  3: THREAT_LEVEL.HIGH,
  4: THREAT_LEVEL.CRITICAL
};

/**
 * One alert per breach episode.
 *
 * A collar sitting inside a zone keeps transmitting, so an alert must not be
 * re-raised on every fix. An open alert always suppresses duplicates. A
 * dismissed (false alarm) or resolved alert also suppresses, but only for
 * FALSE_ALARM_SUPPRESSION_MS — otherwise the officer would be handed the
 * identical false alarm on the next transmission and forever after. Once the
 * window lapses, a genuine repeat breach raises a fresh alert.
 */
export function shouldRaiseAlert(
  alerts,
  { collarId, zoneId, now = Date.now(), cooldownMs = FALSE_ALARM_SUPPRESSION_MS }
) {
  const OPEN = [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED, ALERT_STATUS.DELAYED];
  const HANDLED = [ALERT_STATUS.DISMISSED, ALERT_STATUS.RESOLVED];

  for (const alert of alerts) {
    if (alert.collarId !== collarId || alert.zoneId !== zoneId) continue;
    if (OPEN.includes(alert.status)) return false;

    if (HANDLED.includes(alert.status)) {
      const handledAt = alert.handledAt ? new Date(alert.handledAt).getTime() : 0;
      if (now - handledAt < cooldownMs) return false;
    }
  }
  return true;
}

/**
 * Numeric priority used to order the Active Alerts queue (alternate
 * flow B: proximity to human settlements and animal risk level).
 */
export function priorityScore(alert) {
  const threat = SEVERITY_WEIGHT[alert.threatLevel] ?? 0;
  const proximityKm = Number.isFinite(alert.distanceToSettlementM)
    ? Math.max(0, 6 - alert.distanceToSettlementM / 1_000)
    : 0;
  const speciesRisk = alert.speciesRisk === 'high' ? 120 : alert.speciesRisk === 'medium' ? 60 : 0;
  const delayedPenalty = alert.delayed ? -80 : 0;
  return Math.round(threat + proximityKm * PROXIMITY_WEIGHT_PER_KM + speciesRisk + delayedPenalty);
}

/** Orders alerts highest priority first for the operations officer. */
export function prioritiseAlerts(alerts) {
  return [...alerts].sort((a, b) => priorityScore(b) - priorityScore(a));
}