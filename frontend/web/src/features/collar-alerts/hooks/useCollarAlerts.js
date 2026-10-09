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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState(null);
  const [visibleZoneIds, setVisibleZoneIds] = useState(null);

  // Guards against a slow response from a previous poll overwriting a newer one.
  const requestIdRef = useRef(0);

  /**
   * Alert IDs that have already been announced. Main flow step 4 requires the
   * dashboard to raise an instant critical alert the moment the server
   * detects a breach, so each newly appeared alert is announced exactly once.
   */
  const announcedRef = useRef(new Set());

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
      setDelayedAlerts(nextAlerts.filter((alert) => alert.delayed));

      setVisibleZoneIds((current) => current ?? nextZones.map((zone) => zone.zoneId));

      // Announce the highest priority alert that has not been seen yet. The
      // server already returns the queue ordered by priority, so the first
      // unseen entry is the one the officer must handle first.
      const unseen = nextAlerts.filter((alert) => !announcedRef.current.has(alert.alertId));
      if (unseen.length > 0) {
        nextAlerts.forEach((alert) => announcedRef.current.add(alert.alertId));
        setActiveAlertId(unseen[0].alertId);
      }
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
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

  const lostCollars = useMemo(
    () => collars.filter((collar) => collar.status === COLLAR_STATUS.SIGNAL_LOST).map((c) => c.collarId),
    [collars]
  );

  const settlements = useMemo(() => park?.settlements ?? [], [park]);

  const openAlertCounts = useMemo(() => {
    const counts = {};
    for (const alert of openAlerts) counts[alert.zoneId] = (counts[alert.zoneId] ?? 0) + 1;
    return counts;
  }, [openAlerts]);

  const selectAlert = useCallback((alertId) => setActiveAlertId(alertId), []);
  const closeAlert = useCallback(() => setActiveAlertId(null), []);

  /** Shared path for the four officer responses. */
  const respond = useCallback(
    async (alertId, action, options = {}) => {
      try {
        const result = await api.respondToAlert(alertId, action, options);
        await load();

        if (result.dispatch?.delivered === false) {
          setToast({
            kind: 'error',
            title: 'Dispatch failed',
            body: 'Failed delivery - contact ranger team by radio',
            alertId
          });
        }
        return result;
      } catch (caught) {
        setToast({ kind: 'error', title: 'Action failed', body: caught.message });
        throw caught;
      } finally {
        setActiveAlertId(null);
      }
    },
    [load]
  );

  const acknowledgeAndDispatch = useCallback(
    (alertId) => respond(alertId, 'acknowledge_dispatch').then((result) => {
      setToast({ kind: 'success', title: 'Addressed', body: 'Response Team Dispatched', alertId });
      return result;
    }),
    [respond]
  );

  const monitorClosely = useCallback(
    (alertId) => respond(alertId, 'monitor_closely').then(() => {
      setToast({ kind: 'info', title: 'Monitoring', body: 'Alert kept under observation', alertId });
    }),
    [respond]
  );

  const markFalseAlarm = useCallback(
    (alertId, notes) => respond(alertId, 'mark_false_alarm', { notes }).then(() => {
      setToast({ kind: 'info', title: 'Alert dismissed', body: 'Logged as false alarm', alertId });
    }),
    [respond]
  );

  const decideDelayedPatrolCheck = useCallback(
    (alertId) => respond(alertId, 'dispatch_patch_check').then(() => {
      setToast({ kind: 'success', title: 'Patrol check', body: 'Response Team Dispatched', alertId });
    }),
    [respond]
  );

  const setZoneEnabled = useCallback(
    async (zoneId, enabled) => {
      setZones((current) =>
        current.map((zone) => (zone.zoneId === zoneId ? { ...zone, enabled } : zone))
      );
      setVisibleZoneIds((current) => {
        const ids = current ?? zones.map((zone) => zone.zoneId);
        return enabled ? [...new Set([...ids, zoneId])] : ids.filter((id) => id !== zoneId);
      });
      try {
        await api.setGeofenceEnabled(zoneId, enabled);
        await load();
      } catch (caught) {
        setError(caught.message);
        await load();
      }
    },
    [load, zones]
  );

  const toggleAllZones = useCallback(() => {
    const ids = zones.map((zone) => zone.zoneId);
    const allVisible = (visibleZoneIds ?? ids).length === ids.length;
    setVisibleZoneIds(allVisible ? [] : ids);
  }, [zones, visibleZoneIds]);

  const dismissToast = useCallback(() => setToast(null), []);

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

  return {
    loading,
    error,
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
    auditTrail,
    delayedAlerts,
    lostCollars: visibleLostCollars,
    sessionExpired,
    toast,
    visibleZoneIds: visibleZoneIds ?? zones.map((zone) => zone.zoneId),
    acknowledgeAndDispatch,
    monitorClosely,
    markFalseAlarm,
    decideDelayedPatrolCheck,
    selectAlert,
    closeAlert,
    setZoneEnabled,
    toggleAllZones,
    simulateSignalLost,
    dismissToast,
    dismissSignalLost,
    setSessionExpired,
    // Re-exported so components can read the vocabulary without a second import
    ALERT_STATUS,
    DISPATCH_STATE,
    OPEN_STATUSES
  };
}