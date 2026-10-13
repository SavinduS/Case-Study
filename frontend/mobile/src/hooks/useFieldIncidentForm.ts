import { useRef, useState } from 'react';
import { validateFieldIncident } from '../services/validateFieldIncident';
import { validatePhotoUriAsync } from '../services/validatePhoto';
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
  // Latest photo URI: guards the async size/type check below so a slow
  // lookup for a removed photo can never flag the current (empty) value.
  const latestPhotoUri = useRef<string | null>(options?.initialDraft?.photoUri ?? null);

  function handlePhotoChange(uri: string | null) {
    latestPhotoUri.current = uri;
    setPhotoUriState(uri);
    setPhotoError(null);
    if (!uri) return;
    // Async size/type validation surfaces inline on the form (before Review);
    // unknown sizes stay allowed and the server (413/415) remains authoritative.
    void validatePhotoUriAsync(uri).then((error) => {
      if (latestPhotoUri.current === uri) setPhotoError(error);
    });
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
    // Fold a resolved async photo error (e.g. oversize file) into the sync
    // errors so Review blocks with the inline message already shown.
    if (!nextErrors.photo && photoError) nextErrors.photo = photoError;
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