/**
 * Triage API for supervisor review of submitted field incidents.
 *
 * Same conventions as `services/api.js`: relative `/api` base (Vite proxy,
 * no base URL baked in), JSON bodies, and `ApiError` with `status === 0`
 * for network failures.
 *
 * Assumed backend shapes (no backend changes in this feature):
 * - GET /api/incidents/triage?status=&severity=&q=&page=&limit=
 *   -> { success, data: Incident[], total, page }
 * - GET /api/users?role=responder -> { success, data: User[] }
 *   (a bare array response is also accepted for both GETs)
 * - PATCH /api/incidents/:id/triage
 *   body: { action: 'triage' | 'assign' | 'escalate' | 'reject',
 *           assigneeId?: string, reason?: string }
 *   -> the updated Incident. 409 means another supervisor changed the
 *   status first (the hook surfaces "Status changed by someone else").
 *
 * Incident fields read by the UI (all optional except id/_id):
 *   { id, type, severity, locationText, location: { coordinates },
 *     reporter / reporterName, submittedAt / createdAt, status,
 *     source ('offline_sync' tags the row "Offline"), description,
 *     assignee / assigneeId }
 */

const BASE = '/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (cause) {
    throw new ApiError('Cannot reach the API. Is the backend running?', 0);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status);
  }
  return payload;
}

/** Unwrap { success, data } or a bare array — tolerates either shape. */
function asList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

/**
 * Paged triage queue. Empty filters are omitted from the query; the server
 * owns filtering and paging, the hook renders what it returns.
 */
export async function getTriageIncidents({ status, severity, q, page = 1, limit = 10 } = {}) {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (severity) params.set('severity', severity);
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const payload = await request(`/incidents/triage?${params.toString()}`);
  return {
    incidents: asList(payload),
    total: typeof payload?.total === 'number' ? payload.total : asList(payload).length,
    page: typeof payload?.page === 'number' ? payload.page : page
  };
}

/** Responders for the Assign dropdown. */
export async function getResponders() {
  const payload = await request('/users?role=responder');
  return asList(payload);
}

/** triage | assign (+assigneeId) | escalate | reject (+reason). */
export function patchTriageIncident(id, { action, assigneeId, reason } = {}) {
  return request(`/incidents/${encodeURIComponent(id)}/triage`, {
    method: 'PATCH',
    body: { action, assigneeId, reason }
  });
}
