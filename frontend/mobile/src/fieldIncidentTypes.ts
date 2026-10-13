import type { GpsFix } from './services/location';

// Ranger field-incident capture (F1). Kept separate from the villager
// conflict-report types so the two use cases never collide.
//
// Canonical values match the backend contract exactly
// (backend/utils/fieldIncidentTypes.js FIELD_INCIDENT_TYPES) so reports upload
// without remapping. Verified against the assignment: Main Flow 7 selects
// "Snare / Illegal Hunting Activity", and the backend accepts warming signs a
// ranger actually observes (carcass, tracks, campsite).
//
// The previous mobile draft values ('snare' | 'poacher' | 'elephant' | 'crop')
// were removed: the backend rejects all four with "Unknown incident type"
// (backend/tests/validateFieldIncident.test.js), and 'elephant'/'crop' collide
// with villager conflict-report concepts (constants/incidentTypes.ts). Only
// 'snare' had a verified equivalent and keeps its label below.
export type FieldIncidentType =
  | 'snare_illegal_hunting'
  | 'animal_carcass'
  | 'footprints'
  | 'illegal_campsite';

export interface FieldIncidentLocation extends GpsFix {
  /** True when the ranger dropped the pin manually (GPS denied/unavailable). */
  manual: boolean;
  /** Human-readable label, e.g. a sector name. Resolved by later features. */
  label?: string;
}

export interface FieldIncidentDraft {
  /** ISO timestamp auto-captured when the form opened. Read-only in the UI. */
  capturedAt: string;
  incidentType: FieldIncidentType | null;
  description: string;
  location: FieldIncidentLocation | null;
  photoUri: string | null;
  /** Optional link to the patrol session. Preserved, never route-tracked. */
  patrolId?: string | null;
}

export type FieldIncidentField = 'incidentType' | 'description' | 'location' | 'photo';

export type FieldIncidentErrors = Partial<Record<FieldIncidentField, string>>;

export interface ValidatedFieldIncident {
  capturedAt: string;
  incidentType: FieldIncidentType;
  description: string;
  location: FieldIncidentLocation;
  photoUri: string | null;
  /** Optional patrol link, trimmed when present. Preserved across edits/retries. */
  patrolId?: string | null;
}