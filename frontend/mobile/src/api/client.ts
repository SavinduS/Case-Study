import type {
  ConflictReportConfirmation,
  ReportSubmission,
  SyncResponse
} from '../types';
import { getActiveBaseUrl, getBaseUrl, invalidateBaseUrl, probeServer } from './baseUrl';

// All requests give up after 20 seconds and treat that as "cannot reach the
// server" (reports are then kept on the device and retried later).
const REQUEST_TIMEOUT_MS = 20_000;

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
  constructor(base?: string) {
    super(
      `Cannot reach the server at ${base ?? getActiveBaseUrl()}. It is chosen automatically (Metro host, port 5000/5001, Android emulator, LAN) — check that the backend is running and the Windows firewall allows Node.js.`
    );
    this.name = 'NetworkError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!isForm && options.body !== undefined) headers['Content-Type'] = 'application/json';

  const base = await getBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const method = options.method ?? 'GET';
  const url = `${base}${path}`;
  // Phone-side trace — appears in the Metro terminal
  console.log(`[api] → ${method} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
    console.log(`[api] ${res.ok ? '✓' : '!'} ${res.status} ${method} ${url}`);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.log(`[api] ✗ ${method} ${url} — ${reason}`);
    invalidateBaseUrl(base);
    throw new NetworkError(base);
  } finally {
    clearTimeout(timer);
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

// Reachability check for the My Reports banner
export async function pingServer(): Promise<{ reachable: boolean; base: string }> {
  const { reachable, base } = await probeServer();
  return { reachable, base };
}

export function createReport(body: ReportSubmission): Promise<ConflictReportConfirmation> {
  return request<ConflictReportConfirmation>('/api/conflict-reports', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function getReport(reportId: string): Promise<ConflictReportConfirmation> {
  return request<ConflictReportConfirmation>(`/api/conflict-reports/${reportId}`);
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
