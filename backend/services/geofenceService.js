const {
  pointInPolygon,
  distanceToPolygonMeters,
  haversineDistanceMeters
} = require('../utils/geo');
const {
  THREAT_LEVEL,
  APPROACH_BUFFER_M,
  DEPTH_THRESHOLD_M,
  SETTLEMENT_ESCALATION_M,
  PRIORITY_SETTLEMENT_HORIZON_M,
  SEVERITY_WEIGHT,
  PROXIMITY_WEIGHT_PER_KM
} = require('../utils/collarAlertConstants');

const THREAT_RANK = {
  [THREAT_LEVEL.CRITICAL]: 4,
  [THREAT_LEVEL.HIGH]: 3,
  [THREAT_LEVEL.MEDIUM]: 2,
  [THREAT_LEVEL.LOW]: 1
};

const RANK_TO_THREAT = {
  1: THREAT_LEVEL.LOW,
  2: THREAT_LEVEL.MEDIUM,
  3: THREAT_LEVEL.HIGH,
  4: THREAT_LEVEL.CRITICAL
};

/**
 * GeofenceEngine.evaluateZone — tests one coordinate against one zone.
 * Returns a GeofenceResult. `breached` covers both "inside the zone" and
 * "within the approach buffer", which is the "crossed or is approaching"
 * wording in the main flow.
 */
function evaluateZone([lng, lat], zone, bufferM = APPROACH_BUFFER_M) {
  const coordinates = [lng, lat];
  const distanceM = distanceToPolygonMeters(coordinates, zone.polygon);
  const inside = pointInPolygon(coordinates, zone.polygon);

  return {
    zoneId: zone.zoneId,
    zoneName: zone.name,
    gridRef: zone.gridRef,
    zoneKind: zone.kind,
    threatLevel: zone.threatLevel,
    breached: inside || distanceM <= bufferM,
    isInside: inside,
    approaching: !inside && distanceM <= bufferM,
    distanceToBoundaryM: Math.round(distanceM),
    depthInsideM: inside ? Math.round(distanceM) : 0
  };
}

/**
 * GeofenceEngine.evaluateGeofencing — evaluates a fix against every enabled
 * zone and returns the single most severe breach, or a safe result.
 */
function evaluateGeofence(coordinates, zones, { bufferM = APPROACH_BUFFER_M } = {}) {
  const results = zones.map((zone) => evaluateZone(coordinates, zone, bufferM));
  const breached = results
    .filter((result) => result.breached)
    .sort((a, b) => (
      THREAT_RANK[b.threatLevel] - THREAT_RANK[a.threatLevel]
      || b.distanceToBoundaryM - a.distanceToBoundaryM
    ));

  return { safe: breached.length === 0, result: breached[0] ?? null, all: results };
}

/** GeofenceEngine.findNearestRanger — closest available team to a breach. */
function findNearestRanger(coordinates, rangers) {
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
function distanceToNearestSettlementM(coordinates, settlements = []) {
  let nearest = Infinity;
  for (const settlement of settlements) {
    nearest = Math.min(nearest, haversineDistanceMeters(coordinates, settlement.position));
  }
  return Number.isFinite(nearest) ? Math.round(nearest) : null;
}

/**
 * Threat level for a breach. Monotonic in how far the animal has travelled
 * past the boundary, so an alert can only escalate:
 *   approaching -> the zone's own threat level
 *   inside      -> at least HIGH
 *   deep inside -> one step above the zone level, capped at CRITICAL
 *   near a settlement -> escalates a HIGH/CRITICAL zone to CRITICAL
 */
function deriveSeverity(result, {
  distanceToSettlementM = null,
  depthThresholdM = DEPTH_THRESHOLD_M,
  settlementEscalationM = SETTLEMENT_ESCALATION_M
} = {}) {
  if (!result) return THREAT_LEVEL.LOW;

  const nearSettlement = distanceToSettlementM != null && distanceToSettlementM <= settlementEscalationM;
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

/**
 * Priority used to order the Active Alerts queue (alternate flow B:
 * proximity to human settlements and animal risk level).
 */
function priorityScore({ threatLevel, distanceToSettlementM, speciesRisk, delayed }) {
  const threat = SEVERITY_WEIGHT[threatLevel] ?? 0;
  const proximityKm = distanceToSettlementM != null
    ? Math.max(0, PRIORITY_SETTLEMENT_HORIZON_M / 1000 - distanceToSettlementM / 1000)
    : 0;
  const species = speciesRisk === 'high' ? 120 : speciesRisk === 'medium' ? 60 : 0;
  const delayedPenalty = delayed ? -80 : 0;
  return Math.round(threat + proximityKm * PROXIMITY_WEIGHT_PER_KM + species + delayedPenalty);
}

/** Human label for a geofence kind, used in the alert narrative. */
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

module.exports = {
  evaluateZone,
  evaluateGeofence,
  findNearestRanger,
  distanceToNearestSettlementM,
  deriveSeverity,
  priorityScore,
  zoneKindLabel,
  THREAT_RANK,
  RANK_TO_THREAT
};