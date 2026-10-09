/**
 * Alert lifecycle and response vocabulary for
 * "Manage Wildlife Collar Boundary Alerts".
 * Mirrors the enum fields used by AlertService / OperationsDashboard.
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

/** Officer response actions offered by the alert review panel. */
export const RESPONSE_ACTION = {
  ACKNOWLEDGE_DISPATCH: 'acknowledge_dispatch',
  MONITOR_CLOSELY: 'monitor_closely',
  MARK_FALSE_ALARM: 'mark_false_alarm',
  DISPATCH_PATCH_CHECK: 'dispatch_patch_check'
};

/** Severity score weights — higher means the alert is handled sooner. */
export const SEVERITY_WEIGHT = {
  [THREAT_LEVEL.CRITICAL]: 400,
  [THREAT_LEVEL.HIGH]: 300,
  [THREAT_LEVEL.MEDIUM]: 200,
  [THREAT_LEVEL.LOW]: 100
};

/** Every 1 km closer to a settlement adds this much priority. */
export const PROXIMITY_WEIGHT_PER_KM = 25;

/** Retries before a dispatch notification is marked failed (exception flow 3). */
export const DISPATCH_MAX_RETRIES = 3;

/** Tabs on the OperationsDrawer. */
export const AUDIT_TAB = {
  DELAYED: 'delayed',
  AUDIT: 'audit'
};

/**
 * How long a false alarm or resolved alert keeps suppressing new alerts for
 * the same collar/zone breach episode.
 */
export const FALSE_ALARM_SUPPRESSION_MS = 15 * 60 * 1000;