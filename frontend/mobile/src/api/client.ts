import { API_BASE_URL } from '../config';
import type {
  ConflictReportConfirmation,
  ReportSubmission,
  SyncResponse
} from '../types';

export class ApiError extends Error {
  status: number;
  payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>) {
    super(String(payload.message || `Request failed (${status})`));
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export class NetworkError extends Error {
  constructor(message = 'Cannot reach the server') {
    super(message);
    this.name = 'NetworkError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!isForm && options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new NetworkError();
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = await res.json();
  } catch {
    payload = {};
  }
  if (!res.ok) throw new ApiError(res.status, payload);
  return payload as T;
}

export function createReport(body: ReportSubmission): Promise<ConflictReportConfirmation> {
  return request<ConflictReportConfirmation>('/api/conflict-reports', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function syncReports(reports: ReportSubmission[]): Promise<SyncResponse> {
  return request<SyncResponse>('/api/conflict-reports/sync', {
    method: 'POST',
    body: JSON.stringify({ reports })
  });
}

// E5: photo upload — throws ApiError (413/415) or NetworkError (retryable)
export async function uploadPhoto(localUri: string): Promise<string> {
  const name = (localUri.split('/').pop() || 'photo.jpg').split('?')[0];
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : 'jpg';
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const form = new FormData();
  form.append('photo', {
    uri: localUri,
    name: name.includes('.') ? name : 'photo.jpg',
    type
    // React Native file object shape (not part of the DOM FormData type)
  } as unknown as Blob);

  const data = await request<{ photoUrl: string }>('/api/conflict-reports/photo', {
    method: 'POST',
    body: form
  });
  return data.photoUrl;
}
