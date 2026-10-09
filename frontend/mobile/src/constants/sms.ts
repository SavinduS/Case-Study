import { INCIDENT_LABELS, INCIDENT_TYPE_ORDER } from './incidentTypes';

// Fictional demo hotline — swap here (e.g. to the real DWC hotline 1917)
export const SMS_HOTLINE = '011 234 5678';

// Codes match backend utils/smsParser.js (1..5 in this order)
export const SMS_TYPE_CODES = INCIDENT_TYPE_ORDER.map((type, i) => ({
  code: String(i + 1),
  label: INCIDENT_LABELS[type]
}));

export const SMS_AREA_CODES = [
  'NORTHBOUNDARY',
  'EASTBOUNDARY',
  'SOUTHBOUNDARY',
  'WESTBOUNDARY'
];
