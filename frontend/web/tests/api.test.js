import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as api from '../src/services/api.js';

const ok = (body) => ({
  ok: true,
  status: 200,
  text: () => Promise.resolve(JSON.stringify(body))
});

const fail = (status, message) => ({
  ok: false,
  status,
  text: () => Promise.resolve(JSON.stringify({ message }))
});

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('request building', () => {
  it('calls the API relative to the origin so no base URL is baked in', async () => {
    fetch.mockResolvedValue(ok([]));
    await api.getCollars();
    expect(fetch).toHaveBeenCalledWith('/api/collars', expect.objectContaining({ method: 'GET' }));
  });

  it('sends a JSON body with the right content type', async () => {
    fetch.mockResolvedValue(ok({ alert: {} }));
    await api.respondToAlert('CBA-1', 'mark_false_alarm', { notes: 'drift' });

    const [, options] = fetch.mock.calls[0];
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(options.body)).toEqual({
      action: 'mark_false_alarm',
      notes: 'drift',
      actor: 'officer'
    });
  });

  it('omits a body for reads', async () => {
    fetch.mockResolvedValue(ok([]));
    await api.getAlerts();
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });
});

describe('endpoints', () => {
  it.each([
    ['getPark', () => api.getPark(), '/api/parks/current'],
    ['getGeofences', () => api.getGeofences(), '/api/geofences'],
    ['getCollars', () => api.getCollars(), '/api/collars'],
    ['getRangerTeams', () => api.getRangerTeams(), '/api/parks/ranger-teams'],
    ['getAlerts', () => api.getAlerts(), '/api/alerts'],
    ['getDelayedIncidents', () => api.getDelayedIncidents(), '/api/audit/delayed']
  ])('%s hits %s', async (_name, call, path) => {
    fetch.mockResolvedValue(ok([]));
    await call();
    expect(fetch.mock.calls[0][0]).toBe(path);
  });

  it('requests every status when asking for the alert history', async () => {
    fetch.mockResolvedValue(ok([]));
    await api.getAlertHistory();
    expect(fetch.mock.calls[0][0]).toContain('status=active,acknowledged');
  });

  it('passes the audit limit through', async () => {
    fetch.mockResolvedValue(ok([]));
    await api.getAuditTrail(25);
    expect(fetch.mock.calls[0][0]).toBe('/api/audit?limit=25');
  });

  it('builds the nearest-ranger query from the breach coordinates', async () => {
    fetch.mockResolvedValue(ok({ rangerId: 'RT-01' }));
    await api.getNearestRanger([81.036, 8.241]);
    expect(fetch.mock.calls[0][0]).toBe('/api/parks/ranger-teams/nearest?lng=81.036&lat=8.241');
  });

  it('sends a geofence toggle as a PUT', async () => {
    fetch.mockResolvedValue(ok({ zoneId: 'Z1', enabled: false }));
    await api.setGeofenceEnabled('Z1', false);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/geofences/Z1');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ enabled: false });
  });

  it('reports a signal loss to the gateway endpoint', async () => {
    fetch.mockResolvedValue(ok({ collarId: 'E-512' }));
    await api.reportSignalLost('E-512', true, 'Heartbeat timeout');
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/telemetry/collars/E-512/signal');
    expect(options.method).toBe('PUT');
    expect(JSON.parse(options.body)).toEqual({ lost: true, reason: 'Heartbeat timeout' });
  });
});

describe('error handling', () => {
  it('surfaces the server message on a 4xx', async () => {
    fetch.mockResolvedValue(fail(400, 'Notes are required to mark an alert as a false alarm'));
    await expect(api.respondToAlert('CBA-1', 'mark_false_alarm')).rejects.toThrow(
      'Notes are required to mark an alert as a false alarm'
    );
  });

  it('exposes the status code so the UI can react', async () => {
    fetch.mockResolvedValue(fail(404, 'Alert not found'));
    await expect(api.getAlert?.() ?? api.getAlerts()).rejects.toMatchObject({ status: 404 });
  });

  it('falls back to a generic message when the body is not JSON', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502, text: () => Promise.resolve('<html>bad gateway</html>') });
    await expect(api.getCollars()).rejects.toThrow('Request failed (502)');
  });

  it('reports a network failure in terms the officer can act on', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.getCollars()).rejects.toThrow('Cannot reach the API');
  });

  it('marks a network failure with status 0', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.getCollars()).rejects.toMatchObject({ status: 0 });
  });

  it('handles an empty 204 response', async () => {
    fetch.mockResolvedValue({ ok: true, status: 204, text: () => Promise.resolve('') });
    await expect(api.getCollars()).resolves.toBeNull();
  });

  it('is an ApiError so callers can distinguish it', async () => {
    fetch.mockResolvedValue(fail(500, 'Server error'));
    await expect(api.getCollars()).rejects.toBeInstanceOf(api.ApiError);
  });
});
