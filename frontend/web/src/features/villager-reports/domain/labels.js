/**
 * Display vocabulary for villager conflict reports.
 *
 * The canonical enums live in backend/models/ConflictReport.js; this module
 * only maps the values the API returns onto presentation. No business logic.
 */

export const CONFLICT_INCIDENT_TYPE = {
  ELEPHANT_SIGHTING: 'elephant_sighting',
  CROP_DAMAGE: 'crop_damage',
  WILDLIFE_NEAR_HOME: 'wildlife_near_home',
  WILDLIFE_BLOCKING_ROAD: 'wildlife_blocking_road',
  OTHER_WILDLIFE_CONFLICT: 'other_wildlife_conflict'
};

export const CONFLICT_STATUS = {
  SUBMITTED: 'SUBMITTED',
  RECEIVED: 'RECEIVED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
  RESOLVED: 'RESOLVED'
};

/**
 * How a villager filed the report. The server stores 'app' or 'sms', and the
 * SMS gateway is a materially different channel — no photo, no GPS accuracy,
 * a phone number instead of an account — so the two are reported separately
 * rather than merged into one list.
 */
export const SUBMISSION_METHOD = {
  APP: 'app',
  SMS: 'sms'
};

/** Categories the officer filters by, ordered as the enum is declared. */
export const CONFLICT_TYPE_ORDER = Object.values(CONFLICT_INCIDENT_TYPE);

export const CONFLICT_TYPE_LABEL = {
  [CONFLICT_INCIDENT_TYPE.ELEPHANT_SIGHTING]: 'Elephant sighting',
  [CONFLICT_INCIDENT_TYPE.CROP_DAMAGE]: 'Crop damage',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_NEAR_HOME]: 'Wildlife near home',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_BLOCKING_ROAD]: 'Blocking the road',
  [CONFLICT_INCIDENT_TYPE.OTHER_WILDLIFE_CONFLICT]: 'Other conflict'
};

/** One-line explanation shown under the category name on the cards. */
export const CONFLICT_TYPE_HELP = {
  [CONFLICT_INCIDENT_TYPE.ELEPHANT_SIGHTING]: 'Herd or single animal seen by a villager',
  [CONFLICT_INCIDENT_TYPE.CROP_DAMAGE]: 'Crops destroyed by wildlife',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_NEAR_HOME]: 'Animal came close to a house',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_BLOCKING_ROAD]: 'Animal stopped traffic on a road',
  [CONFLICT_INCIDENT_TYPE.OTHER_WILDLIFE_CONFLICT]: 'Anything else the villager reported'
};

export const CONFLICT_TYPE_TONE = {
  [CONFLICT_INCIDENT_TYPE.ELEPHANT_SIGHTING]: 'high',
  [CONFLICT_INCIDENT_TYPE.CROP_DAMAGE]: 'high',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_NEAR_HOME]: 'medium',
  [CONFLICT_INCIDENT_TYPE.WILDLIFE_BLOCKING_ROAD]: 'medium',
  [CONFLICT_INCIDENT_TYPE.OTHER_WILDLIFE_CONFLICT]: 'neutral'
};

export const CONFLICT_STATUS_LABEL = {
  [CONFLICT_STATUS.SUBMITTED]: 'Submitted',
  [CONFLICT_STATUS.RECEIVED]: 'Received',
  [CONFLICT_STATUS.UNDER_REVIEW]: 'Under review',
  [CONFLICT_STATUS.ACTION_REQUIRED]: 'Action required',
  [CONFLICT_STATUS.RESOLVED]: 'Resolved'
};

export const CONFLICT_STATUS_TONE = {
  [CONFLICT_STATUS.SUBMITTED]: 'neutral',
  [CONFLICT_STATUS.RECEIVED]: 'medium',
  [CONFLICT_STATUS.UNDER_REVIEW]: 'medium',
  [CONFLICT_STATUS.ACTION_REQUIRED]: 'high',
  [CONFLICT_STATUS.RESOLVED]: 'low'
};

export const SUBMISSION_METHOD_LABEL = {
  [SUBMISSION_METHOD.APP]: 'Field app',
  [SUBMISSION_METHOD.SMS]: 'SMS hotline'
};

/** Anything a villager has not marked resolved still needs the officer's eye. */
export const isOpenConflict = (report) => report.status !== CONFLICT_STATUS.RESOLVED;

/**
 * Unknown enums must still render, so every lookup falls back rather than
 * leaving a blank cell the officer would read as missing data.
 */
export const conflictTypeLabel = (type) => CONFLICT_TYPE_LABEL[type] ?? 'Wildlife conflict';
export const conflictStatusLabel = (status) => CONFLICT_STATUS_LABEL[status] ?? status ?? 'Unknown';
export const submissionMethodLabel = (method) =>
  SUBMISSION_METHOD_LABEL[method] ?? (method === 'sms' ? 'SMS hotline' : 'Field app');

/** Timestamp in the GMT convention the rest of the portal uses. */
export const formatReportStamp = (value) =>
  new Date(value).toLocaleString('en-GB', {
    hour12: false,
    timeZone: 'GMT',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

/**
 * Whole days between a report and now, used for the "age" column. Reports are
 * sorted newest first by the server, so this is what tells the officer which
 * end of the list is going stale.
 */
export const ageInDays = (value, now = Date.now()) => {
  const created = new Date(value).getTime();
  if (Number.isNaN(created)) return null;
  return Math.max(0, Math.floor((now - created) / 86_400_000));
};