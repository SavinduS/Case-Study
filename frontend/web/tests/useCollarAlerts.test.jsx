import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import * as api from '../src/services/api.js';
import useCollarAlerts from '../src/features/collar-alerts/hooks/useCollarAlerts.js';
import { ALERT_STATUS } from '../src/features/collar-alerts/domain/labels.js';

const PARK = {
  parkId: 'KNP-ANP',
  name: 'Minneriya National Park',
  boundary: [[81.0, 8.1]],
  settlements: [{ settlementId: 'S1', name: 'Kiri Veedi', position: [80.958, 8.156] }]
};

const ZONES = [{ zoneId: 'Z1', name: 'Elephant Corridor', gridRef: 'G7', kind: 'farmland', threatLevel: 'critical', enabled: true }];

const collars = (list) => list.map((c) => ({ status: 'active', lastKnownLocation: { coordinates: [81, 8] }, ...c }));

const ALERTS = [
  {
    alertId: 'CBA-2',
    collarId: 'E-331',
    zoneId: 'Z1',
    status: ALERT_STATUS.DELAYED,
    delayed: true,
    threatLevel: 'critical',
    detectedAt: '2026-10-09T12:50:00Z'
  },
  {
    alertId: 'CBA-1',
    collarId: 'E-402',
    zoneId: 'Z1',
    status: ALERT_STATUS.ACTIVE,
    delayed: false,
    threatLevel: 'critical',
    detectedAt: '2026-10-09T14:38:00Z'
  }
];

let responses;

beforeEach(() => {
  responses = {
    park: PARK,
    collars: collars([{ collarId: 'E-402' }]),
    zones: ZONES,
    teams: [{ rangerId: 'RT-01', name: 'Kandy', status: 'available', position: [81.02, 8.19] }],
    alerts: ALERTS,
    audit: [{ auditId: 'AUD-1', action: 'ALERT_RAISED', actor: 'GeofenceEngine', detail: 'x', at: '2026-10-09T14:38:00Z' }]
  };

  vi.spyOn(api, 'getPark').mockImplementation(() => Promise.resolve(responses.park));
  vi.spyOn(api, 'getCollars').mockImplementation(() => Promise.resolve(responses.collars));
  vi.spyOn(api, 'getGeofences').mockImplementation(() => Promise.resolve(responses.zones));
  vi.spyOn(api, 'getRangerTeams').mockImplementation(() => Promise.resolve(responses.teams));
  vi.spyOn(api, 'getAlerts').mockImplementation(() => Promise.resolve(responses.alerts));
  vi.spyOn(api, 'getAuditTrail').mockImplementation(() => Promise.resolve(responses.audit));
  vi.spyOn(api, 'getDispatchAttempts').mockImplementation(() => Promise.resolve(responses.attempts ?? []));
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Renders the hook and waits for the first poll to land. */
async function mount() {
  const view = renderHook(() => useCollarAlerts({ pollIntervalMs: 1_000_000 }));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe('useCollarAlerts', () => {
  it('loads the dashboard from the API', async () => {
    const { result } = await mount();
    expect(result.current.park.name).toBe('Minneriya National Park');
    expect(result.current.collars).toHaveLength(1);
    expect(result.current.zones).toHaveLength(1);
    expect(result.current.rangerTeams).toHaveLength(1);
    expect(result.current.auditTrail).toHaveLength(1);
  });

  it('keeps the server ordering of the queue', async () => {
    const { result } = await mount();
    expect(result.current.alerts.map((a) => a.alertId)).toEqual(['CBA-2', 'CBA-1']);
  });

  it('only counts actionable alerts as open', async () => {
    const { result } = await mount();
    expect(result.current.openAlerts).toHaveLength(2);

    responses.alerts = [{ ...ALERTS[0], status: ALERT_STATUS.DISMISSED }];
    const { result: updated } = await mount();
    expect(updated.current.openAlerts).toHaveLength(0);
  });

  it('raises the critical alert for a newly detected breach', async () => {
    const { result } = await mount();
    // The first poll announces the highest priority unseen alert.
    expect(result.current.activeAlert?.alertId).toBe('CBA-2');

    act(() => result.current.closeAlert());
    expect(result.current.activeAlert).toBeNull();
  });

  it('does not re-announce the same alert on the next poll', async () => {
    const { result } = await mount();
    act(() => result.current.closeAlert());
    await act(async () => { await result.current.refresh(); });
    expect(result.current.activeAlert).toBeNull();
  });

  it('announces a breach that appears after the first poll', async () => {
    const { result } = await mount();
    act(() => result.current.closeAlert());

    responses.alerts = [
      { ...ALERTS[1], alertId: 'CBA-9', status: ALERT_STATUS.ACTIVE },
      ...ALERTS
    ];
    await act(async () => { await result.current.refresh(); });

    expect(result.current.activeAlert?.alertId).toBe('CBA-9');
  });

  it('selects an alert the officer picks from the queue', async () => {
    const { result } = await mount();
    act(() => result.current.selectAlert('CBA-1'));
    expect(result.current.activeAlert?.alertId).toBe('CBA-1');
  });

  it('exposes the delayed incidents for the records drawer', async () => {
    const { result } = await mount();
    expect(result.current.delayedAlerts.map((a) => a.alertId)).toEqual(['CBA-2']);
  });

  it('counts open breaches per zone for the geofence panel', async () => {
    const { result } = await mount();
    expect(result.current.openAlertCounts).toEqual({ Z1: 2 });
  });

  it('lists collars flagged signal lost', async () => {
    responses.collars = collars([{ collarId: 'E-402' }, { collarId: 'E-512', status: 'signal_lost' }]);
    const { result } = await mount();
    expect(result.current.lostCollars).toEqual(['E-512']);
  });

  it('surfaces an API failure instead of rendering nothing', async () => {
    vi.spyOn(api, 'getCollars').mockRejectedValue(new Error('Cannot reach the API'));
    const { result } = await mount();
    expect(result.current.error).toBe('Cannot reach the API');
  });

  it('clears a previous error once the API recovers', async () => {
    vi.spyOn(api, 'getCollars').mockRejectedValueOnce(new Error('boom'));
    const { result } = await mount();
    expect(result.current.error).toBe('boom');

    await act(async () => { await result.current.refresh(); });
    expect(result.current.error).toBeNull();
  });
});

describe('officer responses', () => {
  it('sends the acknowledge action and shows the dispatch toast', async () => {
    const respond = vi.spyOn(api, 'respondToAlert').mockResolvedValue({
      alert: { alertId: 'CBA-1', status: 'acknowledged' },
      dispatch: { delivered: true, attempts: 1 }
    });
    const { result } = await mount();

    await act(async () => { await result.current.acknowledgeAndDispatch('CBA-1'); });

    // The action name is the contract; the api layer owns the defaulting.
    expect(respond.mock.calls[0].slice(0, 2)).toEqual(['CBA-1', 'acknowledge_dispatch']);
    expect(result.current.toast).toMatchObject({ kind: 'success', title: 'Addressed' });
  });

  it('tells the officer to use the radio when delivery fails', async () => {
    vi.spyOn(api, 'respondToAlert').mockResolvedValue({
      alert: { alertId: 'CBA-1', status: 'acknowledged' },
      dispatch: { delivered: false, attempts: 3 }
    });
    const { result } = await mount();

    await act(async () => { await result.current.acknowledgeAndDispatch('CBA-1'); });

    expect(result.current.toast).toMatchObject({ kind: 'error' });
    expect(result.current.toast.body).toMatch(/radio/i);
  });

  it('sends the officer note with a false alarm', async () => {
    const respond = vi.spyOn(api, 'respondToAlert').mockResolvedValue({ alert: { status: 'dismissed' } });
    const { result } = await mount();

    await act(async () => { await result.current.markFalseAlarm('CBA-1', 'Signal drift.'); });

    expect(respond.mock.calls[0][1]).toBe('mark_false_alarm');
    expect(respond.mock.calls[0][2]).toMatchObject({ notes: 'Signal drift.' });
  });

  it('dispatches a patrol check for a delayed incident', async () => {
    const respond = vi.spyOn(api, 'respondToAlert').mockResolvedValue({ alert: { status: 'acknowledged' } });
    const { result } = await mount();

    await act(async () => { await result.current.decideDelayedPatrolCheck('CBA-2'); });

    expect(respond.mock.calls[0].slice(0, 2)).toEqual(['CBA-2', 'dispatch_patch_check']);
  });

  it('closes the alert and reports a failure when the API rejects', async () => {
    vi.spyOn(api, 'respondToAlert').mockRejectedValue(new Error('Notes are required'));
    const { result } = await mount();

    await act(async () => {
      await result.current.markFalseAlarm('CBA-1', '').catch(() => {});
    });

    expect(result.current.toast).toMatchObject({ kind: 'error', title: 'Action failed' });
    expect(result.current.activeAlert).toBeNull();
  });

  it('refreshes after an action so the queue reflects the server', async () => {
    vi.spyOn(api, 'respondToAlert').mockResolvedValue({ alert: { status: 'acknowledged' }, dispatch: { delivered: true } });
    const { result } = await mount();

    const callsBefore = api.getAlerts.mock.calls.length;
    await act(async () => { await result.current.monitorClosely('CBA-1'); });

    expect(api.getAlerts.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('geofence visibility', () => {
  it('shows every zone by default', async () => {
    const { result } = await mount();
    expect(result.current.visibleZoneIds).toEqual(['Z1']);
  });

  it('persists a single zone toggle and refreshes', async () => {
    const setEnabled = vi.spyOn(api, 'setGeofenceEnabled').mockImplementation(async (zoneId, enabled) => {
      // The server owns the truth, so the next read reflects the change.
      responses.zones = responses.zones.map((z) => (z.zoneId === zoneId ? { ...z, enabled } : z));
      return { zoneId, enabled };
    });
    const { result } = await mount();

    await act(async () => { await result.current.setZoneEnabled('Z1', false); });

    expect(setEnabled).toHaveBeenCalledWith('Z1', false);
    expect(result.current.visibleZoneIds).toEqual([]);
  });

  it('restores the server visibility when a toggle fails', async () => {
    vi.spyOn(api, 'setGeofenceEnabled').mockRejectedValue(new Error('nope'));
    const { result } = await mount();

    await act(async () => { await result.current.setZoneEnabled('Z1', false); });

    expect(result.current.error).toBe('nope');
    // The map must not keep showing a zone as hidden when the server refused.
    await waitFor(() => expect(result.current.visibleZoneIds).toEqual(['Z1']));
  });

  it('toggles all zones at once and persists each change', async () => {
    const setEnabled = vi.spyOn(api, 'setGeofenceEnabled').mockImplementation(async (zoneId, enabled) => {
      responses.zones = responses.zones.map((z) => (z.zoneId === zoneId ? { ...z, enabled } : z));
      return { zoneId, enabled };
    });
    const { result } = await mount();

    await act(async () => { await result.current.toggleAllZones(); });
    expect(result.current.visibleZoneIds).toEqual([]);
    expect(setEnabled).toHaveBeenCalledWith('Z1', false);

    await act(async () => { await result.current.toggleAllZones(); });
    expect(result.current.visibleZoneIds).toEqual(['Z1']);
    expect(setEnabled).toHaveBeenCalledWith('Z1', true);
  });
});

describe('demo controls', () => {
  it('reports a signal loss through the API and refreshes', async () => {
    const report = vi.spyOn(api, 'reportSignalLost').mockResolvedValue({ collarId: 'E-207' });
    const { result } = await mount();

    await act(async () => { await result.current.simulateSignalLost(); });

    expect(report).toHaveBeenCalledWith('E-207', true, 'Gateway heartbeat timeout');
  });

  it('can dismiss the signal lost banner without clearing the collar', async () => {
    responses.collars = collars([{ collarId: 'E-512', status: 'signal_lost' }]);
    const { result } = await mount();
    expect(result.current.lostCollars).toEqual(['E-512']);

    act(() => result.current.dismissSignalLost());
    expect(result.current.lostCollars).toEqual([]);
    // The database still says the collar is down.
    expect(responses.collars[0].status).toBe('signal_lost');
  });

  it('announces every alert once, so a poll refresh never re-announces the same breach', async () => {
    const { result } = await mount();
    // The server already returns the queue in priority order, so the first
    // unseen entry is the one the officer has to handle first.
    expect(result.current.announced.map((a) => a.alertId)).toEqual(['CBA-2', 'CBA-1']);
    expect(result.current.activeAlert.alertId).toBe('CBA-2');

    // The 3s poll returns the same open alerts; nothing new is announced.
    await act(async () => { await result.current.refresh(); });
    expect(result.current.announced.map((a) => a.alertId)).toEqual(['CBA-2', 'CBA-1']);

    responses.alerts = [{ ...ALERTS[1], alertId: 'CBA-3' }, ...ALERTS];
    await act(async () => { await result.current.refresh(); });
    expect(result.current.announced.map((a) => a.alertId)).toEqual(['CBA-3']);
    expect(result.current.activeAlert.alertId).toBe('CBA-3');
  });

  it('keeps the banner on the highest priority open alert until it is silenced', async () => {
    const { result } = await mount();
    expect(result.current.bannerAlert.alertId).toBe('CBA-2');

    act(() => result.current.silenceAlert('CBA-2'));
    expect(result.current.bannerAlert.alertId).toBe('CBA-1');

    act(() => result.current.unsilenceAlert('CBA-2'));
    expect(result.current.bannerAlert.alertId).toBe('CBA-2');
  });

  it('refuses a second response while the first is still in flight', async () => {
    const { result } = await mount();
    let release;
    vi.spyOn(api, 'respondToAlert').mockImplementation(
      () => new Promise((resolve) => { release = resolve; })
    );

    let first;
    let second;
    await act(async () => {
      first = result.current.acknowledgeAndDispatch('CBA-1');
      second = result.current.acknowledgeAndDispatch('CBA-1');
    });

    expect(api.respondToAlert).toHaveBeenCalledTimes(1);
    expect(result.current.responding['CBA-1']).toBe('acknowledge_dispatch');

    await act(async () => { release({ alert: {}, dispatch: { delivered: true } }); await first; });
    expect(await second).toBeNull();
    expect(result.current.responding['CBA-1']).toBeUndefined();
  });

  it('tells an unreachable API apart from a server error', async () => {
    const network = new api.ApiError('Cannot reach the API. Is the backend running?', 0);
    vi.spyOn(api, 'getAlerts').mockRejectedValueOnce(network);
    const offlineView = await mount();
    expect(offlineView.result.current.offline).toBe(true);
    expect(offlineView.result.current.error).toMatch(/Cannot reach the API/);

    vi.spyOn(api, 'getAlerts').mockRejectedValueOnce(new api.ApiError('Request failed (500)', 500));
    const serverView = await mount();
    expect(serverView.result.current.offline).toBe(false);
    expect(serverView.result.current.error).toBe('Request failed (500)');
  });

  it('loads the delivery-attempt log for an alert', async () => {
    responses.attempts = [{ alertId: 'CBA-1', attempt: 1, state: 'failed', error: 'unreachable' }];
    const { result } = await mount();
    let loaded;
    await act(async () => { loaded = await result.current.loadDispatchAttempts('CBA-1'); });
    expect(api.getDispatchAttempts).toHaveBeenCalledWith('CBA-1');
    expect(loaded).toHaveLength(1);
    expect(result.current.dispatchAttempts).toHaveLength(1);
  });

  it('dismisses the toast', async () => {
    const { result } = await mount();
    vi.spyOn(api, 'respondToAlert').mockResolvedValue({ alert: {}, dispatch: { delivered: true } });
    await act(async () => { await result.current.acknowledgeAndDispatch('CBA-1'); });
    expect(result.current.toast).not.toBeNull();

    act(() => result.current.dismissToast());
    expect(result.current.toast).toBeNull();
  });
});
