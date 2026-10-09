export type IncidentType =
  | 'elephant_sighting'
  | 'crop_damage'
  | 'wildlife_near_home'
  | 'wildlife_blocking_road'
  | 'other_wildlife_conflict';

export type Coordinates = [number, number];

export interface ReportSubmission {
  incidentType: IncidentType;
  location: { coordinates: Coordinates };
  description?: string;
  accuracyMeters?: number;
  locationText?: string;
  photoUrl?: string;
  reporterContact?: string;
  clientRefId?: string;
}

export interface ConflictReportConfirmation {
  reportId: string;
  status: string;
  submissionMethod: string;
  incidentType: IncidentType;
  locationText?: string;
  createdAt: string;
  isPossibleDuplicate?: boolean;
  duplicateOfReportId?: string | null;
}

export interface SyncResult {
  clientRefId?: string;
  ok: boolean;
  reportId?: string;
  status?: string;
  alreadySynced?: boolean;
  message?: string | null;
  errors?: Record<string, string> | null;
}

export interface SyncResponse {
  synced: number;
  results: SyncResult[];
}

export interface QueuedReport {
  clientRefId: string;
  payload: ReportSubmission;
  photoUri?: string;
  status: 'PENDING_UPLOAD' | 'RECEIVED';
  reportId?: string;
  createdAt: string;
  lastError?: string;
}
