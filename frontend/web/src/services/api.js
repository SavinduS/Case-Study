/**
 * HTTP client for the Collar Boundary Alerts API.
 *
 * Every request is relative and proxied by Vite (see vite.config.js) so the
 * browser talks to the same origin and no API base URL is baked into the
 * bundle. All breach detection and persistence lives on the server; this
 * layer only moves data.
 *
 * The API requires a signed-in officer or Park Manager on every collar, park,
 * alert and audit route, so the session token is attached here rather than in
 * each feature. A 401 means the token expired or was revoked: the session is
 * dropped and the app is sent back to the sign-in page instead of quietly
 * polling with a token the server will never accept.
 */

const BASE = '/api';

import { readSession } from './session.js';

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Set by the router shell so a 401 can drop the session and redirect to
 * sign-in exactly once, whatever feature made the call. Kept as an injected
 * function so services/api.js does not have to import the router.
 */
let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

function authHeader() {
  const token = readSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...authHeader(),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (cause) {
    throw new ApiError('Cannot reach the API. Is the backend running?', 0);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  // A proxy or gateway can answer with an HTML error page rather than JSON,
  // so parsing must not be allowed to replace the real status message.
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Expired or revoked session. The feature layer only sees a thrown
      // ApiError; the handler is what signs the officer out.
      await onUnauthorized?.();
    }
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status);
  }
  return payload;
}

/** Reference data: park boundary, geofences, collars and ranger teams. */
export const getPark = () => request('/parks/current');
export const getGeofences = () => request('/geofences');
export const getCollars = (status) =>
  request(status ? `/collars?status=${encodeURIComponent(status)}` : '/collars');
export const getRangerTeams = () => request('/parks/ranger-teams');

/**
 * Sign in to the portal. `identifier` is an email address or a phone number.
 * Returns `{ id, name, role, token }` — the role is decided by the server.
 */
export const login = (identifier, password) =>
  request('/auth/login', { method: 'POST', body: { identifier, password } });

/** Open alerts, already ordered by the server's priority score. */
export const getAlerts = () => request('/alerts');

/** Every alert including ones already handled, newest first. */
export const getAlertHistory = () => request('/alerts?status=active,acknowledged,delayed,dismissed,resolved');

/** One alert, used when the officer opens an incident from the records drawer. */
export const getAlert = (alertId) => request(`/alerts/${encodeURIComponent(alertId)}`);

/** Every delivery attempt made for an alert, for exception flow 3. */
export const getDispatchAttempts = (alertId) =>
  request(`/alerts/${encodeURIComponent(alertId)}/dispatch-attempts`);

export const getAuditTrail = (limit = 100, alertId) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (alertId) params.set('alertId', alertId);
  return request(`/audit?${params}`);
};
export const getDelayedIncidents = () => request('/audit/delayed');
export const getNearestRanger = ([lng, lat]) => request(`/parks/ranger-teams/nearest?lng=${lng}&lat=${lat}`);

/**
 * Officer responses. `action` is one of the server's supported responses.
 * The acting officer is taken from the session token on the server; nothing
 * identifying the user is sent from here.
 */
export function respondToAlert(alertId, action, { notes = null } = {}) {
  return request(`/alerts/${encodeURIComponent(alertId)}/respond`, { method: 'POST', body: { action, notes } });
}

/** Shows or hides a geofence on the map and in breach evaluation. */
export const setGeofenceEnabled = (zoneId, enabled) =>
  request(`/geofences/${encodeURIComponent(zoneId)}`, { method: 'PUT', body: { enabled } });

/** Reports a gateway dropout so the dashboard can raise the Signal Lost banner. */
export const reportSignalLost = (collarId, lost = true, reason) =>
  request(`/telemetry/collars/${encodeURIComponent(collarId)}/signal`, { method: 'PUT', body: { lost, reason } });

/**
 * Pushes a collar fix through the normal gateway ingest endpoint, so the
 * breach is detected by the server exactly as it would be from real hardware.
 * Used by the dashboard's demonstration controls and by the end-to-end flow.
 */
export const submitFix = (fixs, { delayed = false } = {}) =>
  request('/telemetry/fixes', { method: 'POST', body: { fixes: fixs, delayed } });

// Field incidents (ranger offline flow). `body.clientId` is the device-made
// idempotency key the offline queue attaches — see src/offline/syncQueue.js.
export const createIncident = (body) => request('/incidents', { method: 'POST', body });
export const getMyIncidents = () => request('/incidents/mine');

// Analytics workspace contract. Kept alongside the shared client so feature
// pages and consumers can use one API surface.
export const getAnalyticsReport = (criteria) =>
  request('/analytics/generate', { method: 'POST', body: criteria });
export const getSavedAnalyticsReports = () => request('/analytics/reports');
export const saveAnalyticsReport = (criteria) =>
  request('/analytics/generate', { method: 'POST', body: criteria });
export const exportAnalyticsReport = (reportId, format) =>
  request(`/analytics/reports/${encodeURIComponent(reportId)}/export?format=${format}`);

export { ApiError };