import { MAX_DESCRIPTION_LENGTH } from '../constants/fieldIncident.ts';
import type {
  FieldIncidentDraft,
  FieldIncidentErrors,
  ValidatedFieldIncident
} from '../fieldIncidentTypes.ts';

// Pure validator: no React Native imports, so it stays unit-testable with
// plain `node --test`. NOTE: the `.ts` extensions above are intentional -
// Node type-stripping needs them, and Metro / `tsc` accept them as well.
export function validateFieldIncident(draft: FieldIncidentDraft): FieldIncidentErrors {
  const errors: FieldIncidentErrors = {};

  if (!draft.incidentType) {
    errors.incidentType = 'Select the type of incident.';
  }

  const description = draft.description.trim();
  if (!description) {
    errors.description = 'Enter a short description of what you found.';
  } else if (draft.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description =
      `Keep the description within ${MAX_DESCRIPTION_LENGTH} characters ` +
      `(currently ${draft.description.length}).`;
  }

  if (!draft.location) {
    errors.location = 'Location is required. Retry GPS or set it on the map.';
  }

  return errors;
}

// Returns the review-ready incident, or null when fields are missing.
// The Review Incident button (F1) only navigates when this is non-null;
// actual review / submit / storage belong to later features (F2 / F3).
export function toValidatedFieldIncident(
  draft: FieldIncidentDraft
): ValidatedFieldIncident | null {
  const errors = validateFieldIncident(draft);
  if (Object.keys(errors).length > 0) return null;
  if (!draft.incidentType || !draft.location) return null;
  return {
    capturedAt: draft.capturedAt,
    incidentType: draft.incidentType,
    description: draft.description.trim(),
    location: draft.location,
    photoUri: draft.photoUri
  };
}