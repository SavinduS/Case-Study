/**
 * HTTP client for the Collar Boundary Alerts API.
 *
 * Every request is relative and proxied by Vite (see vite.config.js) so the
 * browser talks to the same origin and no API base URL is baked into the
 * bundle. All breach detection and persistence lives on the server; this
 * layer only moves data.
 */

const BASE = '/api';

class ApiError extends Error {
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
    throw new ApiError(payload?.message ?? `Request failed (${response.status})`, response.status);
  }
  return payload;
}

/** Reference data: park boundary, geofences, collars and ranger teams. */
export const getPark = () => request('/parks/current');
export const getGeofences = () => request('/geofences');
export const getCollars = () => request('/collars');
export const getRangerTeams = () => request('/parks/ranger-teams');

/** Open alerts, already ordered by the server's priority score. */
export const getAlerts = () => request('/alerts');

/** Every alert including ones already handled, newest first. */
export const getAlertHistory = () => request('/alerts?status=active,acknowledged,delayed,dismissed,resolved');

export const getAuditTrail = (limit = 100) => request(`/audit?limit=${limit}`);
export const getDelayedIncidents = () => request('/audit/delayed');
export const getNearestRanger = ([lng, lat]) => request(`/parks/ranger-teams/nearest?lng=${lng}&lat=${lat}`);

/** Officer responses. `action` is one of the server's supported responses. */
export function respondToAlert(alertId, action, { notes = null, actor = 'officer' } = {}) {
  return request(`/alerts/${alertId}/respond`, { method: 'POST', body: { action, notes, actor } });
}

/** Shows or hides a geofence on the map and in breach evaluation. */
export const setGeofenceEnabled = (zoneId, enabled) =>
  request(`/geofences/${zoneId}`, { method: 'PUT', body: { enabled } });

/** Reports a gateway dropout so the dashboard can raise the Signal Lost banner. */
export const reportSignalLost = (collarId, lost = true, reason) =>
  request(`/telemetry/collars/${collarId}/signal`, { method: 'PUT', body: { lost, reason } });

/** Field incidents (ranger offline flow). `body.clientId` is the device-made
 * idempotency key the offline queue attaches — see src/offline/syncQueue.js. */
export const createIncident = (body) => request('/incidents', { method: 'POST', body });
export const getMyIncidents = () => request('/incidents/mine');

export { ApiError };
