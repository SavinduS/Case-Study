import type { FieldIncidentType } from '../fieldIncidentTypes';

// Labels for the canonical backend incident types. 'Snare / Illegal Hunting
// Activity' keeps the storyboard/wireframe wording; the other three describe
// the ranger-observed evidence the backend accepts.
export const FIELD_INCIDENT_LABELS: Record<FieldIncidentType, string> = {
  snare_illegal_hunting: 'Snare / Illegal Hunting Activity',
  animal_carcass: 'Animal Carcass',
  footprints: 'Footprints / Animal Tracks',
  illegal_campsite: 'Illegal Campsite'
};

export const FIELD_INCIDENT_TYPE_ORDER: FieldIncidentType[] = [
  'snare_illegal_hunting',
  'animal_carcass',
  'footprints',
  'illegal_campsite'
];

export const MAX_DESCRIPTION_LENGTH = 500;

/** Photo evidence rule: optional, JPEG/PNG only when supplied, up to 5 MB. */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** GPS fix give-up time. Exceeding it leads to manual map selection (Alt 1). */
export const LOCATION_TIMEOUT_MS = 12_000;

export const OFFLINE_MESSAGE =
  'This report will be saved on this device while offline and synchronized when connectivity returns.';