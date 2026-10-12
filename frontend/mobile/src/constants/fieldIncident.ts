import type { FieldIncidentType } from '../fieldIncidentTypes';

// Incident values match backend/models/Incident.js `type` enum so a later
// sync feature (F3) can upload without remapping.
export const FIELD_INCIDENT_LABELS: Record<FieldIncidentType, string> = {
  snare: 'Snare / Illegal Hunting Activity',
  poacher: 'Poacher Sighting',
  elephant: 'Elephant Sighting',
  crop: 'Crop Damage'
};

export const FIELD_INCIDENT_TYPE_ORDER: FieldIncidentType[] = [
  'snare',
  'poacher',
  'elephant',
  'crop'
];

export const MAX_DESCRIPTION_LENGTH = 500;

/** GPS fix give-up time. Exceeding it leads to manual map selection (Alt 1). */
export const LOCATION_TIMEOUT_MS = 12_000;

export const OFFLINE_MESSAGE =
  'This report will be saved on this device while offline and synchronized when connectivity returns.';