import { File } from 'expo-file-system';
import { isAuthSession } from '../auth/sessionShape';
import type { AuthSession } from '../auth/types';
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

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  if (!isForm && options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

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

// Sign in with either the email address or the phone number. The server
// decides the role, so the response is checked for a usable session before it
// reaches the UI — a role the app cannot route on must not reach the app as a
// half-valid session.
export async function login(identifier: string, password: string): Promise<AuthSession> {
  const data = await request<Record<string, unknown>>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password })
  });
  if (!isAuthSession(data)) {
    throw new ApiError(500, {
      message: 'Sign-in response was not understood. Please try again.'
    });
  }
  return data;
}

// Revalidate a stored session on app start. Throws ApiError(401) when the
// token expired or the account was removed.
export async function fetchMe(
  token: string
): Promise<Omit<AuthSession, 'token'>> {
  return request<Omit<AuthSession, 'token'>>('/api/auth/me', {}, token);
}

// Public sign-up for villagers. The server always creates a villager account
// regardless of anything sent here; the response is the same session shape as
// login, so the caller can drop straight into the app.
export async function registerVillager(input: {
  name: string;
  phone: string;
  password: string;
  email?: string;
}): Promise<AuthSession> {
  const data = await request<Record<string, unknown>>('/api/auth/register/villager', {
    method: 'POST',
    body: JSON.stringify(input)
  });
  if (!isAuthSession(data)) {
    throw new ApiError(500, {
      message: 'Sign-up response was not understood. Please try again.'
    });
  }
  return data;
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
  const file = new File(localUri);
  form.append('photo', {
    name: name.includes('.') ? name : 'photo.jpg',
    type,
    bytes: async () => new Uint8Array(await file.bytes())
  } as unknown as Blob);

  const data = await request<{ photoUrl: string }>('/api/conflict-reports/photo', {
    method: 'POST',
    body: form
  });
  return data.photoUrl;
}
