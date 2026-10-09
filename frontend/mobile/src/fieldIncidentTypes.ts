import type { GpsFix } from './services/location';

// Ranger field-incident capture (F1). Kept separate from the villager
// conflict-report types so the two use cases never collide.
export type FieldIncidentType = 'snare' | 'poacher' | 'elephant' | 'crop';

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
}

export type FieldIncidentField = 'incidentType' | 'description' | 'location';

export type FieldIncidentErrors = Partial<Record<FieldIncidentField, string>>;

export interface ValidatedFieldIncident {
  capturedAt: string;
  incidentType: FieldIncidentType;
  description: string;
  location: FieldIncidentLocation;
  photoUri: string | null;
}