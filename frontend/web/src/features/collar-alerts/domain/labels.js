/**
 * Display vocabulary for the collar boundary alert UI.
 *
 * The canonical enums live on the server; this module only maps the values
 * the API returns onto presentation. No business logic here.
 */

export const ALERT_STATUS = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
  DELAYED: 'delayed'
};

export const THREAT_LEVEL = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

export const COLLAR_STATUS = {
  ACTIVE: 'active',
  DELAYED: 'delayed',
  SIGNAL_LOST: 'signal_lost'
};

export const DISPATCH_STATE = {
  IDLE: 'idle',
  SENDING: 'sending',
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

/** Actions the officer can take, as accepted by POST /alerts/:id/respond. */
export const RESPONSE_ACTION = {
  ACKNOWLEDGE_DISPATCH: 'acknowledge_dispatch',
  MONITOR_CLOSELY: 'monitor_closely',
  MARK_FALSE_ALARM: 'mark_false_alarm',
  DISPATCH_PATCH_CHECK: 'dispatch_patch_check'
};

export const AUDIT_TAB = {
  DELAYED: 'delayed',
  AUDIT: 'audit'
};

export const ALERT_STATUS_LABEL = {
  [ALERT_STATUS.ACTIVE]: 'Active',
  [ALERT_STATUS.ACKNOWLEDGED]: 'Acknowledged',
  [ALERT_STATUS.RESOLVED]: 'Resolved',
  [ALERT_STATUS.DISMISSED]: 'False alarm',
  [ALERT_STATUS.DELAYED]: 'Delayed incident'
};

export const ALERT_STATUS_TONE = {
  [ALERT_STATUS.ACTIVE]: 'high',
  [ALERT_STATUS.ACKNOWLEDGED]: 'medium',
  [ALERT_STATUS.RESOLVED]: 'low',
  [ALERT_STATUS.DISMISSED]: 'neutral',
  [ALERT_STATUS.DELAYED]: 'medium'
};

export const THREAT_TONE = {
  [THREAT_LEVEL.CRITICAL]: 'high',
  [THREAT_LEVEL.HIGH]: 'high',
  [THREAT_LEVEL.MEDIUM]: 'medium',
  [THREAT_LEVEL.LOW]: 'low'
};

export const COLLAR_STATUS_LABEL = {
  [COLLAR_STATUS.ACTIVE]: 'Transmitting',
  [COLLAR_STATUS.DELAYED]: 'Delayed batch',
  [COLLAR_STATUS.SIGNAL_LOST]: 'Signal lost'
};

export const COLLAR_STATUS_TONE = {
  [COLLAR_STATUS.ACTIVE]: 'low',
  [COLLAR_STATUS.DELAYED]: 'medium',
  [COLLAR_STATUS.SIGNAL_LOST]: 'high'
};

/** Sub-label for the threat badge, mirroring the high-fidelity wireframe. */
export const ZONE_KIND_LABEL = {
  farmland: 'Poaching Risk Zone',
  village: 'Village Conflict Zone',
  road: 'Road Crossing Hazard',
  settlement: 'Settlement Buffer',
  other: 'High-Risk Zone'
};

export const ZONE_KIND_SHORT = {
  farmland: 'Farmland',
  village: 'Village edge',
  road: 'Road crossing',
  settlement: 'Settlement',
  other: 'High-risk'
};

/** Breaches the officer can still act on. */
export const OPEN_STATUSES = [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED, ALERT_STATUS.DELAYED];

/** Breaches already actioned. */
export const HANDLED_STATUSES = [ALERT_STATUS.DISMISSED, ALERT_STATUS.RESOLVED];

export const isOpen = (alert) => OPEN_STATUSES.includes(alert.status);

export const formatGmt = (value) =>
  `${new Date(value).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'GMT' })} GMT`;

export const formatGmtStamp = (value) =>
  new Date(value).toLocaleString('en-GB', {
    hour12: false,
    timeZone: 'GMT',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
