// Alert lifecycle and response vocabulary for
// "Manage Wildlife Collar Boundary Alerts".
const ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  DELAYED: 'delayed'
};

const THREAT_LEVEL = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

const COLLAR_STATUS = {
  ACTIVE: 'active',
  DELAYED: 'delayed',
  SIGNAL_LOST: 'signal_lost'
};

const RANGER_STATUS = {
  AVAILABLE: 'available',
  ON_PATROL: 'on_patrol',
  DISPATCHED: 'dispatched'
};

const DISPATCH_STATE = {
  IDLE: 'idle',
  SENDING: 'sending',
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

/** Retries before a dispatch notification is marked failed (exception flow 3). */
const DISPATCH_MAX_RETRIES = 3;

/** Distance (m) outside a zone that still counts as "approaching" the boundary. */
const APPROACH_BUFFER_M = 400;

/** Depth (m) inside a zone before a breach is treated as deep. */
const DEPTH_THRESHOLD_M = 500;

/** A settlement within this range escalates the threat level. */
const SETTLEMENT_ESCALATION_M = 1500;

/** Proximity used when scoring alert priority (alternate flow B). */
const PRIORITY_SETTLEMENT_HORIZON_M = 6000;

/** How long a dismissed/resolved alert suppresses new alerts for that breach. */
const FALSE_ALARM_SUPPRESSION_MS = 15 * 60 * 1000;

const AUDIT_ACTION = {
  ALERT_RAISED: 'ALERT_RAISED',
  ALERT_ACKNOWLEDGED: 'ALERT_ACKNOWLEDGED',
  MONITOR_CLOSELY: 'MONITOR_CLOSELY',
  MARKED_FALSE_ALARM: 'MARKED_FALSE_ALARM',
  DELAYED_INCIDENT_FLAGGED: 'DELAYED_INCIDENT_FLAGGED',
  PATROL_CHECK_DISPATCHED: 'PATROL_CHECK_DISPATCHED',
  RANGER_DISPATCHED: 'RANGER_DISPATCHED',
  DISPATCH_FAILED: 'DISPATCH_FAILED',
  SIGNAL_LOST: 'SIGNAL_LOST',
  COLLAR_REGISTERED: 'COLLAR_REGISTERED'
};

const SEVERITY_WEIGHT = {
  [THREAT_LEVEL.CRITICAL]: 400,
  [THREAT_LEVEL.HIGH]: 300,
  [THREAT_LEVEL.MEDIUM]: 200,
  [THREAT_LEVEL.LOW]: 100
};

const PROXIMITY_WEIGHT_PER_KM = 25;

module.exports = {
  ALERT_STATUS,
  THREAT_LEVEL,
  COLLAR_STATUS,
  RANGER_STATUS,
  DISPATCH_STATE,
  DISPATCH_MAX_RETRIES,
  APPROACH_BUFFER_M,
  DEPTH_THRESHOLD_M,
  SETTLEMENT_ESCALATION_M,
  PRIORITY_SETTLEMENT_HORIZON_M,
  FALSE_ALARM_SUPPRESSION_MS,
  AUDIT_ACTION,
  SEVERITY_WEIGHT,
  PROXIMITY_WEIGHT_PER_KM
};