import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../../services/api.js';
import {
  ALERT_STATUS,
  COLLAR_STATUS,
  DISPATCH_STATE,
  OPEN_STATUSES,
  isOpen
} from '../domain/labels.js';

const POLL_INTERVAL_MS = 3000;

/**
 * useCollarAlerts - view model for "Manage Wildlife Collar Boundary Alerts".
 *
 * All breach detection, severity scoring, queue ordering and persistence
 * happen on the server; this hook only fetches what the database holds and
 * sends officer responses back. It polls because the telemetry gateway posts
 * asynchronously, so the dashboard is never the source of a state change.
 */
export default function useCollarAlerts({ pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const [park, setPark] = useState(null);
  const [collars, setCollars] = useState([]);
  const [zones, setZones] = useState([]);
  const [rangerTeams, setRangerTeams] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [delayedAlerts, setDelayedAlerts] = useState([]);
  const [dispatchAttempts, setDispatchAttempts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [responding, setResponding] = useState({});

  // Ref mirror of `responding`. Two clicks in the same tick both close over
  // the same render's `responding`, so only a ref can stop the second request.
  const inFlightRef = useRef({});

  // Guards against a slow response from a previous poll overwriting a newer one.
  const requestIdRef = useRef(0);

  /**
   * Alert IDs that have already been announced. Main flow step 4 requires the
   * dashboard to raise an instant critical alert the moment the server
   * detects a breach, so each newly appeared alert is announced exactly once —
   * to the modal, to the banner and to the alarm.
   */
  const announcedRef = useRef(new Set());

  /**
   * The batch of alerts announced by the most recent successful poll. The
   * audible alarm is driven from here rather than from the alert list, so the
   * 3-second refresh that returns the same open breach never restarts it.
   */
  const [announced, setAnnounced] = useState([]);

  /** Alerts the officer has seen the banner for but has not opened. */
  const [silencedAlertIds, setSilencedAlertIds] = useState([]);

  const load = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      const [nextPark, nextCollars, nextZones, nextTeams, nextAlerts, nextAudit] = await Promise.all([
        api.getPark(),
        api.getCollars(),
        api.getGeofences(),
        api.getRangerTeams(),
        api.getAlerts(),
        api.getAuditTrail(60)
      ]);

      if (requestId !== requestIdRef.current) return;

      setPark(nextPark);
      setCollars(nextCollars);
      setZones(nextZones);
      setRangerTeams(nextTeams);
      setAlerts(nextAlerts);
      setAuditTrail(nextAudit);
      setError(null);
      setOffline(false);
      setLastUpdatedAt(new Date());
      setDelayedAlerts(nextAlerts.filter((alert) => alert.delayed));

      // Announce the highest priority alert that has not been seen yet. The
      // server already returns the queue ordered by priority, so the first
      // unseen entry is the one the officer must handle first.
      const unseen = nextAlerts.filter((alert) => !announcedRef.current.has(alert.alertId));
      if (unseen.length > 0) {
        nextAlerts.forEach((alert) => announcedRef.current.add(alert.alertId));
        setAnnounced(unseen);
        setActiveAlertId(unseen[0].alertId);
      }
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      // Status 0 is the browser's "could not reach the server at all"; any
      // other status is a real server-side failure. The banner says which, so
      // an outage is never mistaken for a broken record.
      setOffline(caught?.status === 0 || caught?.status === undefined);
      setError(caught.message);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, pollIntervalMs);
    return () => clearInterval(timer);
  }, [load, pollIntervalMs]);

  const openAlerts = useMemo(() => alerts.filter(isOpen), [alerts]);

  const activeAlert = useMemo(
    () => alerts.find((alert) => alert.alertId === activeAlertId) ?? null,
    [alerts, activeAlertId]
  );

  /**
   * The alert the banner shows: the highest priority open alert that has not
   * been silenced, so closing the modal never removes the red strip.
   */
  const bannerAlert = useMemo(() => {
    const silenced = new Set(silencedAlertIds);
    return openAlerts.find((alert) => !silenced.has(alert.alertId)) ?? null;
  }, [openAlerts, silencedAlertIds]);

  /** Shows the banner again without changing the incident's state. */
  const unsilenceAlert = useCallback(
    (alertId) => setSilencedAlertIds((ids) => ids.filter((id) => id !== alertId)),
    []
  );

  const silenceAlert = useCallback((alertId) => {
    setSilencedAlertIds((ids) => (ids.includes(alertId) ? ids : [...ids, alertId]));
  }, []);

  const lostCollars = useMemo(
    () => collars.filter((collar) => collar.status === COLLAR_STATUS.SIGNAL_LOST).map((c) => c.collarId),
    [collars]
  );

  const settlements = useMemo(() => park?.settlements ?? [], [park]);

  /**
   * Zone visibility is the server's `enabled` flag, not local state. Keeping a
   * local copy let the map drift out of step with the database when a toggle
   * failed, and a zone that is hidden locally but enabled in the database is
   * still evaluated for breaches.
   */
  const visibleZoneIds = useMemo(
    () => zones.filter((zone) => zone.enabled !== false).map((zone) => zone.zoneId),
    [zones]
  );

  const openAlertCounts = useMemo(() => {
    const counts = {};
    for (const alert of openAlerts) counts[alert.zoneId] = (counts[alert.zoneId] ?? 0) + 1;
    return counts;
  }, [openAlerts]);

  const selectAlert = useCallback((alertId) => {
    setActiveAlertId(alertId);
    setSilencedAlertIds((ids) => ids.filter((id) => id !== alertId));
  }, []);
  const closeAlert = useCallback(() => setActiveAlertId(null), []);

  /**
   * Shared path for the four officer responses. Only transport failures raise
   * a toast here; whether the dispatch itself succeeded is decided by the
   * caller so a failed delivery is never reported as a success.
   *
   * `responding` tracks in-flight actions per alert so a double click cannot
   * dispatch the same incident twice — the server would answer 409 for the
   * second, but the officer should not have to see that.
   */
  const respond = useCallback(
    async (alertId, action, options = {}) => {
      if (inFlightRef.current[alertId]) return null;
      inFlightRef.current = { ...inFlightRef.current, [alertId]: action };
      setResponding(inFlightRef.current);

      try {
        const result = await api.respondToAlert(alertId, action, options);
        const attempts = await api
          .getDispatchAttempts(alertId)
          .catch(() => []);
        setDispatchAttempts(attempts);
        await load();
        return result;
      } catch (caught) {
        setToast({ kind: 'error', title: 'Action failed', body: caught.message, alertId });
        throw caught;
      } finally {
        const { [alertId]: _done, ...rest } = inFlightRef.current;
        inFlightRef.current = rest;
        setResponding(rest);
        setActiveAlertId(null);
      }
    },
    [load]
  );

  const toastForDispatch = useCallback((result, success) => {
    if (result?.dispatch?.delivered === false) {
      setToast({
        kind: 'error',
        title: 'Failed delivery',
        body: `${result.dispatch.error ?? 'Ranger mobile unit unreachable'} — contact the ranger team by radio.`
      });
      return;
    }
    setToast(success);
  }, []);

  const acknowledgeAndDispatch = useCallback(
    (alertId) =>
      respond(alertId, 'acknowledge_dispatch').then((result) => {
        if (!result) return null;
        toastForDispatch(result, {
          kind: 'success',
          title: 'Addressed',
          body: result.ranger
            ? `Response team notified: ${result.ranger.name}`
            : 'Response team notified',
          alertId
        });
        return result;
      }),
    [respond, toastForDispatch]
  );

  const monitorClosely = useCallback(
    (alertId) =>
      respond(alertId, 'monitor_closely').then((result) => {
        if (!result) return null;
        setToast({ kind: 'info', title: 'Monitoring', body: 'Alert kept under observation', alertId });
        return result;
      }),
    [respond]
  );

  const markFalseAlarm = useCallback(
    (alertId, notes) =>
      respond(alertId, 'mark_false_alarm', { notes }).then((result) => {
        if (!result) return null;
        setToast({ kind: 'info', title: 'Alert dismissed', body: 'Logged as false alarm', alertId });
        return result;
      }),
    [respond]
  );

  const decideDelayedPatrolCheck = useCallback(
    (alertId) =>
      respond(alertId, 'dispatch_patch_check').then((result) => {
        if (!result) return null;
        toastForDispatch(result, {
          kind: 'success',
          title: 'Patrol check',
          body: 'Ranger team notified',
          alertId
        });
        return result;
      }),
    [respond, toastForDispatch]
  );

  const setZoneEnabled = useCallback(
    async (zoneId, enabled) => {
      // Optimistic, but the load below always restores the server's truth.
      setZones((current) =>
        current.map((zone) => (zone.zoneId === zoneId ? { ...zone, enabled } : zone))
      );
      try {
        await api.setGeofenceEnabled(zoneId, enabled);
        await load();
      } catch (caught) {
        // The refresh clears `error`, so report the failure after it.
        await load();
        setError(caught.message);
      }
    },
    [load]
  );

  const toggleAllZones = useCallback(async () => {
    const shouldShow = visibleZoneIds.length !== zones.length;
    const changes = zones
      .filter((zone) => (zone.enabled !== false) !== shouldShow)
      .map((zone) => setZoneEnabled(zone.zoneId, shouldShow));
    await Promise.all(changes);
  }, [zones, visibleZoneIds, setZoneEnabled]);

  const dismissToast = useCallback(() => setToast(null), []);

  /**
   * Loads the delivery-attempt log for one alert, so exception flow 3 is
   * visible whether the officer is looking at a dispatch that just failed or
   * one from earlier in the shift.
   */
  const loadDispatchAttempts = useCallback(async (alertId) => {
    if (!alertId) return [];
    try {
      const attempts = await api.getDispatchAttempts(alertId);
      setDispatchAttempts(attempts);
      return attempts;
    } catch {
      // A missing log is not an error the officer needs to act on; the alert
      // modal already reports the dispatch state from the alert record.
      return [];
    }
  }, []);

  /**
   * Hides the Signal Lost banner without touching the collar. The collar
   * stays flagged in the database and in the Collar Registry until the
   * gateway actually restores the link, so this is presentation only.
   */
  const [dismissedCollars, setDismissedCollars] = useState([]);
  const visibleLostCollars = useMemo(
    () => lostCollars.filter((collarId) => !dismissedCollars.includes(collarId)),
    [lostCollars, dismissedCollars]
  );
  const dismissSignalLost = useCallback(() => setDismissedCollars(lostCollars), [lostCollars]);

  /** Reports a gateway dropout so the backend flags the collar Signal Lost. */
  const simulateSignalLost = useCallback(
    async (collarId = 'E-207') => {
      try {
        await api.reportSignalLost(collarId, true, 'Gateway heartbeat timeout');
        await load();
      } catch (caught) {
        setError(caught.message);
      }
    },
    [load]
  );

  /**
   * Posts a collar fix through the real gateway endpoint, so the breach is
   * detected by the server exactly as it would be from real hardware. This is
   * how the dashboard demonstrates the main flow when no physical collar is on
   * the network.
   */
  const pushFix = useCallback(
    async (fix) => {
      try {
        const result = await api.submitFix([fix], { delayed: Boolean(fix.delayed) });
        await load();
        return result;
      } catch (caught) {
        setToast({ kind: 'error', title: 'Telemetry rejected', body: caught.message });
        return null;
      }
    },
    [load]
  );

  return {
    loading,
    error,
    offline,
    lastUpdatedAt,
    refresh: load,
    park,
    collars,
    zones,
    settlements,
    rangerTeams,
    alerts,
    openAlerts,
    openAlertCounts,
    activeAlert,
    bannerAlert,
    announced,
    auditTrail,
    delayedAlerts,
    dispatchAttempts,
    lostCollars: visibleLostCollars,
    toast,
    visibleZoneIds,
    responding,
    acknowledgeAndDispatch,
    monitorClosely,
    markFalseAlarm,
    decideDelayedPatrolCheck,
    selectAlert,
    closeAlert,
    silenceAlert,
    unsilenceAlert,
    loadDispatchAttempts,
    setZoneEnabled,
    toggleAllZones,
    simulateSignalLost,
    pushFix,
    dismissToast,
    dismissSignalLost,
    // Re-exported so components can read the vocabulary without a second import
    ALERT_STATUS,
    DISPATCH_STATE,
    OPEN_STATUSES
  };
}