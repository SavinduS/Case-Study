import { File } from 'expo-file-system';
import { request } from './client';
import type { FieldIncidentType, ValidatedFieldIncident } from '../fieldIncidentTypes';

// Canonical backend incident types (backend/utils/fieldIncidentTypes.js).
// Identical to the mobile FieldIncidentType union by design, so the mapping
// below is the identity for current values.
export type BackendFieldIncidentType =
  | 'snare_illegal_hunting'
  | 'animal_carcass'
  | 'footprints'
  | 'illegal_campsite';

export const BACKEND_FIELD_INCIDENT_TYPES: BackendFieldIncidentType[] = [
  'snare_illegal_hunting',
  'animal_carcass',
  'footprints',
  'illegal_campsite'
];

export function isBackendFieldIncidentType(value: unknown): value is BackendFieldIncidentType {
  return (
    typeof value === 'string' &&
    (BACKEND_FIELD_INCIDENT_TYPES as string[]).includes(value)
  );
}

// Legacy mobile draft values predate the backend contract. Only 'snare' has a
// verified equivalent ('Snare / Illegal Hunting Activity', assignment Main
// Flow 7): the backend rejects 'poacher' | 'elephant' | 'crop' with "Unknown
// incident type", and 'elephant' | 'crop' belong to the villager
// conflict-report domain (constants/incidentTypes.ts), so no mapping is
// guessed for them — they resolve to null and the caller surfaces the server's
// validation error instead of silently remapping.
const LEGACY_TO_BACKEND: Record<string, BackendFieldIncidentType> = {
  snare: 'snare_illegal_hunting'
};

/** Map any incident-type string to the backend contract, or null when the
 * meaning cannot be verified (caller must not guess — let the server reject
 * it with a field error). */
export function toBackendIncidentType(value: string): BackendFieldIncidentType | null {
  if (isBackendFieldIncidentType(value)) return value;
  return LEGACY_TO_BACKEND[value] ?? null;
}

/**
 * Resolve the type string to send. Verified values map exactly; anything else
 * passes through untouched so the server — the authority — rejects it with a
 * field-level 400 instead of the client inventing a wrong category.
 */
export function resolveBackendIncidentType(value: string): string {
  return toBackendIncidentType(value) ?? value;
}

export interface FieldIncidentServerPhoto {
  path: string;
  mimeType: string;
  size: number;
}

export interface FieldIncidentResponse {
  reportId: string;
  displayId: string;
  incidentType: string;
  description: string;
  location: { type: string; coordinates: [number, number]; source: string; accuracy?: number };
  capturedAt: string;
  receivedAt: string;
  photo: FieldIncidentServerPhoto | null;
  reporter: string | null;
  patrolId?: string;
  createdAt: string;
  updatedAt: string;
  alreadySynced?: boolean;
}

export interface FieldIncidentSyncResult {
  reportId: string;
  ok: boolean;
  displayId: string | null;
  alreadySynced: boolean;
  message: string | null;
  errors: unknown;
}

export interface FieldIncidentSyncResponse {
  synced: number;
  results: FieldIncidentSyncResult[];
}

export interface MyFieldIncidentsResponse {
  count: number;
  reports: FieldIncidentResponse[];
}

function photoMimeType(localUri: string): string {
  const name = (localUri.split('/').pop() || '').split('?')[0];
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  // Truthful fallback: the backend allowlist (JPEG/PNG) rejects anything else
  // with 415 before storing, so a photo is never saved under a wrong type.
  return 'application/octet-stream';
}

function photoFileName(localUri: string): string {
  const name = (localUri.split('/').pop() || '').split('?')[0];
  return name.includes('.') ? name : 'photo.jpg';
}

/**
 * Build the multipart body for POST /api/field-incidents.
 * Mobile `location.coordinates` are already GeoJSON [lng, lat]; the API takes
 * flat fields, so latitude = coordinates[1], longitude = coordinates[0].
 * Photo is appended only when a photoUri exists (backend photo is optional).
 */
export function buildFieldIncidentForm(
  reportId: string,
  incident: ValidatedFieldIncident
): FormData {
  const [lng, lat] = incident.location.coordinates;
  const form = new FormData();
  form.append('reportId', reportId);
  form.append('incidentType', resolveBackendIncidentType(incident.incidentType));
  form.append('description', incident.description);
  form.append('latitude', String(lat));
  form.append('longitude', String(lng));
  form.append('locationSource', incident.location.manual ? 'manual' : 'gps');
  if (typeof incident.location.accuracyMeters === 'number') {
    form.append('accuracy', String(incident.location.accuracyMeters));
  }
  form.append('capturedAt', incident.capturedAt);
  if (incident.photoUri) {
    const file = new File(incident.photoUri);
    form.append('photo', {
      name: photoFileName(incident.photoUri),
      type: photoMimeType(incident.photoUri),
      bytes: async () => new Uint8Array(await file.bytes())
    } as unknown as Blob);
  }
  return form;
}

/** JSON item for POST /api/field-incidents/sync (photo-less; photo uploads go
 * through the multipart single POST so evidence is never dropped). */
export function toSyncPayloadItem(reportId: string, incident: ValidatedFieldIncident) {
  const [lng, lat] = incident.location.coordinates;
  return {
    reportId,
    incidentType: resolveBackendIncidentType(incident.incidentType),
    description: incident.description,
    location: {
      coordinates: [lng, lat] as [number, number],
      source: incident.location.manual ? 'manual' : 'gps',
      ...(typeof incident.location.accuracyMeters === 'number'
        ? { accuracy: incident.location.accuracyMeters }
        : {})
    },
    capturedAt: incident.capturedAt
  };
}

// Status contract (backend/controllers/fieldIncidentController.js):
// 201 created, 200 already-synced (idempotent retry), 400 validation
// ({message, errors:[{field,message}]}), 401 unauthenticated, 413 photo too
// large, 415 photo type rejected, 5xx server failure. Unreachable/timeout
// raises NetworkError via the shared helper — the caller keeps the report
// pending and retries later.
export function postFieldIncident(
  reportId: string,
  incident: ValidatedFieldIncident,
  token: string
): Promise<FieldIncidentResponse> {
  return request<FieldIncidentResponse>('/api/field-incidents', {
    method: 'POST',
    body: buildFieldIncidentForm(reportId, incident)
  }, token);
}

export function syncFieldIncidents(
  items: { reportId: string; incident: ValidatedFieldIncident }[],
  token: string
): Promise<FieldIncidentSyncResponse> {
  return request<FieldIncidentSyncResponse>('/api/field-incidents/sync', {
    method: 'POST',
    body: JSON.stringify({
      reports: items.map(({ reportId, incident }) => toSyncPayloadItem(reportId, incident))
    })
  }, token);
}

export function fetchMyFieldIncidents(
  token: string,
  limit = 50
): Promise<MyFieldIncidentsResponse> {
  return request<MyFieldIncidentsResponse>(
    `/api/field-incidents/mine?limit=${encodeURIComponent(String(limit))}`,
    {},
    token
  );
}

export function fetchFieldIncident(reportId: string, token: string): Promise<FieldIncidentResponse> {
  return request<FieldIncidentResponse>(
    `/api/field-incidents/${encodeURIComponent(reportId)}`,
    {},
    token
  );
}
