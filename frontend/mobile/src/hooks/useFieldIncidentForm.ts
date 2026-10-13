import { useState } from 'react';
import { validateFieldIncident } from '../services/validateFieldIncident';
import type {
  FieldIncidentDraft,
  FieldIncidentErrors,
  FieldIncidentLocation,
  FieldIncidentType,
  ValidatedFieldIncident
} from '../fieldIncidentTypes';

export interface UseFieldIncidentFormOptions {
  initialDraft?: Partial<FieldIncidentDraft>;
}

export interface UseFieldIncidentFormResult {
  /** ISO timestamp captured once when the form opened. Display read-only. */
  capturedAt: string;
  incidentType: FieldIncidentType | null;
  description: string;
  photoUri: string | null;
  photoError: string | null;
  errors: FieldIncidentErrors;
  attempted: boolean;
  setIncidentType: (value: FieldIncidentType) => void;
  setDescription: (value: string) => void;
  handlePhotoChange: (uri: string | null) => void;
  setPhotoError: (message: string | null) => void;
  /**
   * Validates the draft for the Review Incident button. Returns the
   * review-ready incident, or null (with inline errors set) when fields
   * are missing. Storage / submit belong to later features (F2 / F3).
   */
  review: (location: FieldIncidentLocation | null) => ValidatedFieldIncident | null;
}

export function useFieldIncidentForm(
  options?: UseFieldIncidentFormOptions
): UseFieldIncidentFormResult {
  const [capturedAt] = useState<string>(
    () => options?.initialDraft?.capturedAt ?? new Date().toISOString()
  );
  const [incidentType, setIncidentType] = useState<FieldIncidentType | null>(
    options?.initialDraft?.incidentType ?? null
  );
  const [description, setDescription] = useState<string>(
    options?.initialDraft?.description ?? ''
  );
  const [photoUri, setPhotoUriState] = useState<string | null>(
    options?.initialDraft?.photoUri ?? null
  );
  // Optional patrol-session link. No patrol-tracking UI here (out of approved
  // scope): the value is only preserved when a host supplies it via
  // initialDraft (e.g. an active patrol session) so edits/retries never drop
  // it. Trimmed on review; blank stays null.
  const [patrolId] = useState<string | null>(
    options?.initialDraft?.patrolId ?? null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldIncidentErrors>({});
  const [attempted, setAttempted] = useState(false);

  function handlePhotoChange(uri: string | null) {
    setPhotoUriState(uri);
    setPhotoError(null);
  }

  function review(location: FieldIncidentLocation | null): ValidatedFieldIncident | null {
    const draft: FieldIncidentDraft = {
      capturedAt,
      incidentType,
      description,
      location,
      photoUri,
      patrolId
    };
    const nextErrors = validateFieldIncident(draft);
    setErrors(nextErrors);
    setAttempted(true);
    if (Object.keys(nextErrors).length > 0) return null;
    if (!incidentType || !location) return null;
    const trimmedPatrolId =
      typeof patrolId === 'string' && patrolId.trim() !== '' ? patrolId.trim() : null;
    return {
      capturedAt,
      incidentType,
      description: description.trim(),
      location,
      photoUri,
      patrolId: trimmedPatrolId
    };
  }

  return {
    capturedAt,
    incidentType,
    description,
    photoUri,
    photoError,
    errors,
    attempted,
    setIncidentType,
    setDescription,
    handlePhotoChange,
    setPhotoError,
    review
  };
}