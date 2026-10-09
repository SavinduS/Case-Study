import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import MockTelemetryGateway from '../services/telemetryService.js';
import NotificationService from '../services/dispatchService.js';
import {
  evaluateGeofence,
  deriveSeverity,
  findNearestRanger,
  prioritiseAlerts,
  shouldRaiseAlert,
  distanceToNearestSettlementM
} from '../domain/geofenceEngine.js';
import {
  createBoundaryAlert,
  createAuditEntry,
  AUDIT_ACTION
} from '../domain/alertFactory.js';
import { ALERT_STATUS } from '../domain/constants.js';
import { COLLARS, HIGH_RISK_ZONES, RANGERS, SETTLEMENTS, OFFICER } from '../data/parkData.js';

/** Distance (m) outside a zone that still counts as "approaching". */
const APPROACH_BUFFER_M = 400;

const initialState = {
  collars: COLLARS,
  alerts: [],
  auditTrail: [],
  activeAlertId: null,
  lostCollars: [],
  sessionExpired: false,
  toast: null
};

/**
 * Single reducer for the use case so every status change produces an
 * audit trail entry (main flow step 12).
 */
function reducer(state, action) {
  switch (action.type) {
    case 'fix':
      return { ...state, collars: upsertCollar(state.collars, action.collar) };

    case 'alert_raised':
      return {
        ...state,
        alerts: [action.alert, ...state.alerts],
        activeAlertId: action.alert.alertId,
        auditTrail: [action.audit, ...state.auditTrail]
      };

    case 'alert_updated':
      return {
        ...state,
        alerts: state.alerts.map((alert) =>
          alert.alertId === action.alertId ? { ...alert, ...action.patch } : alert
        ),
        auditTrail: action.audit ? [action.audit, ...state.auditTrail] : state.auditTrail
      };

    case 'select_alert':
      return { ...state, activeAlertId: action.alertId };

    case 'dismiss_active':
      return { ...state, activeAlertId: null };

    case 'signal_lost':
      return {
        ...state,
        collars: state.collars.map((collar) =>
          collar.collarId === action.collarId ? { ...collar, status: 'signal_lost' } : collar
        ),
        lostCollars: state.lostCollars.includes(action.collarId)
          ? state.lostCollars
          : [...state.lostCollars, action.collarId],
        auditTrail: [action.audit, ...state.auditTrail]
      };

    case 'signal_lost_clear':
      return { ...state, lostCollars: [] };

    case 'toast':
      return { ...state, toast: action.toast };

    case 'session_expired':
      return { ...state, sessionExpired: action.value };

    default:
      return state;
  }
}

function upsertCollar(collars, next) {
  const index = collars.findIndex((collar) => collar.collarId === next.collarId);
  if (index === -1) return [...collars, next];
  const updated = [...collars];
  updated[index] = { ...updated[index], ...next };
  return updated;
}

/** Replaces a collar's live position with one recorded in the past. */
function collarAt(collar, position) {
  return { ...collar, position };
}

/**
 * useCollarAlerts — controller for "Manage Wildlife Collar Boundary Alerts".
 *
 * Owns the live telemetry subscription, geofence evaluation, the Active
 * Alerts queue and the audit trail. The backend will replace
 * MockTelemetryGateway / NotificationService with HTTP calls; the reducer
 * and the domain layer stay unchanged.
 */
export default function useCollarAlerts({
  autoStart = true,
  intervalMs = 3000,
  dispatchAlwaysFails = false
} = {}) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  /**
   * Mirrors state.alerts but is also updated synchronously the moment an
   * alert is raised. A delayed batch replay raises several alerts inside a
   * single tick, before React re-renders, so the reducer state alone would
   * still look empty and the dedupe check would pass them all through.
   */
  const alertsRef = useRef(state.alerts);
  useEffect(() => {
    alertsRef.current = state.alerts;
  }, [state.alerts]);

  const gatewayRef = useRef(null);
  const notifierRef = useRef(null);

  if (!gatewayRef.current) gatewayRef.current = new MockTelemetryGateway(COLLARS, { intervalMs });
  if (!notifierRef.current) notifierRef.current = new NotificationService({ shouldFail: () => dispatchAlwaysFails });

  const evaluateFix = useCallback((collar, at, { delayed = false } = {}) => {
    const { result } = evaluateGeofence(collar.position, HIGH_RISK_ZONES, {
      bufferM: APPROACH_BUFFER_M
    });
    if (!result) return null;

    // A collar inside a zone keeps transmitting; raise one alert per episode.
    if (!shouldRaiseAlert(alertsRef.current, { collarId: collar.collarId, zoneId: result.zoneId })) {
      return null;
    }

    const distanceToSettlementM = distanceToNearestSettlementM(collar.position, SETTLEMENTS);
    const severity = deriveSeverity(result, { distanceToSettlementM });
    const alert = createBoundaryAlert({
      collar,
      result,
      detectedAt: at,
      severity,
      delayed
    });
    alert.severity = severity;
    alertsRef.current = [alert, ...alertsRef.current];

    const audit = createAuditEntry({
      action: delayed ? AUDIT_ACTION.DELAYED_INCIDENT_FLAGGED : AUDIT_ACTION.ALERT_RAISED,
      alert,
      actor: delayed ? 'GeofenceEngine' : 'GeofenceEngine',
      detail: delayed
        ? `Retroactive breach reconstructed from batch upload in ${result.zoneName}.`
        : `${collar.collarId} entered ${result.zoneName} (${result.gridRef}).`,
      at
    });

    dispatch({ type: 'alert_raised', alert, audit });
    return alert;
  }, []);

  const handleEvent = useCallback(
    (event) => {
      switch (event.type) {
        case 'fix': {
          dispatch({ type: 'fix', collar: event.collar });
          evaluateFix(event.collar, event.at);
          break;
        }
        case 'signal_lost': {
          const alert = createAuditEntry({
            action: AUDIT_ACTION.SIGNAL_LOST,
            alert: null,
            actor: 'CollarGateway',
            detail: `Telemetry link lost for ${event.collarId}: ${event.reason}.`,
            at: event.at
          });
          dispatch({ type: 'signal_lost', collarId: event.collarId, audit: alert });
          break;
        }
        case 'signal_restored': {
          // Alternate flow D: replay historical fixes as delayed incidents.
          const collar = stateRef.current.collars.find((c) => c.collarId === event.collarId);
          if (!collar) break;
          event.batch.forEach((fix) => {
            dispatch({ type: 'fix', collar: collarAt(collar, fix.position) });
            evaluateFix(collarAt(collar, fix.position), new Date(fix.recordedAt), { delayed: true });
          });
          break;
        }
        default:
          break;
      }
    },
    [evaluateFix]
  );

  useEffect(() => {
    const gateway = gatewayRef.current;
    const unsubscribe = gateway.subscribe(handleEvent);
    if (autoStart) gateway.start();
    return () => {
      unsubscribe();
      gateway.stop();
    };
  }, [autoStart, handleEvent]);

  const alertsByPriority = useMemo(() => prioritiseAlerts(state.alerts), [state.alerts]);
  const openAlerts = useMemo(
    () =>
      alertsByPriority.filter((alert) =>
        [ALERT_STATUS.ACTIVE, ALERT_STATUS.ACKNOWLEDGED, ALERT_STATUS.DELAYED].includes(alert.status)
      ),
    [alertsByPriority]
  );
  const activeAlert = useMemo(
    () => state.alerts.find((alert) => alert.alertId === state.activeAlertId) ?? null,
    [state.alerts, state.activeAlertId]
  );

  const patchAlert = useCallback((alertId, patch, audit) => {
    dispatch({ type: 'alert_updated', alertId, patch, audit });
  }, []);

  const selectAlert = useCallback((alertId) => dispatch({ type: 'select_alert', alertId }), []);

  const closeAlert = useCallback(() => dispatch({ type: 'dismiss_active' }), []);

  /** Main flow steps 8-12: acknowledge and dispatch the nearest ranger. */
  const acknowledgeAndDispatch = useCallback(
    async (alertId) => {
      const alert = stateRef.current.alerts.find((item) => item.alertId === alertId);
      if (!alert) return null;

      const ranger = findNearestRanger(alert.position, RANGERS);
      patchAlert(
        alertId,
        { status: ALERT_STATUS.ACKNOWLEDGED, handledBy: OFFICER.officerId, handledAt: new Date(), dispatchState: 'sending' },
        createAuditEntry({
          action: AUDIT_ACTION.ALERT_ACKNOWLEDGED,
          alert,
          actor: OFFICER.officerId,
          detail: `Alert ${alert.alertId} acknowledged by ${OFFICER.name}.`,
        })
      );

      const outcome = await notifierRef.current.sendDispatch(alert, ranger);
      const current = stateRef.current.alerts.find((item) => item.alertId === alertId);

      if (outcome.delivered) {
        patchAlert(
          alertId,
          { dispatchState: 'delivered', dispatchedTo: ranger?.name ?? null, dispatchAttempts: outcome.attempts },
          createAuditEntry({
            action: AUDIT_ACTION.RANGER_DISPATCHED,
            alert: current ?? alert,
            actor: 'NotificationService',
            detail: `${ranger?.name ?? 'Nearest ranger team'} dispatched after ${outcome.attempts} attempt(s).`,
          })
        );
        dispatch({
          type: 'toast',
          toast: { kind: 'success', title: 'Addressed', body: 'Response Team Dispatched', alertId }
        });
      } else {
        patchAlert(
          alertId,
          { dispatchState: 'failed', dispatchAttempts: outcome.attempts },
          createAuditEntry({
            action: AUDIT_ACTION.DISPATCH_FAILED,
            alert: current ?? alert,
            actor: 'NotificationService',
            detail: `Dispatch failed after ${outcome.attempts} retries. Use radio.`,
          })
        );
        dispatch({
          type: 'toast',
          toast: {
            kind: 'error',
            title: 'Dispatch failed',
            body: 'Failed delivery - contact ranger team by radio',
            alertId
          }
        });
      }

      dispatch({ type: 'dismiss_active' });
      return outcome;
    },
    [patchAlert]
  );

  /** Alternate flow: officer keeps the animal under observation. */
  const monitorClosely = useCallback(
    (alertId) => {
      const alert = stateRef.current.alerts.find((item) => item.alertId === alertId);
      if (!alert) return;
      patchAlert(
        alertId,
        { status: ALERT_STATUS.ACKNOWLEDGED, handledBy: OFFICER.officerId, handledAt: new Date() },
        createAuditEntry({
          action: AUDIT_ACTION.MONITOR_CLOSELY,
          alert,
          actor: OFFICER.officerId,
          detail: 'Officer elected to monitor the animal closely without dispatch.',
        })
      );
      dispatch({ type: 'toast', toast: { kind: 'info', title: 'Monitoring', body: 'Alert kept under observation' } });
      dispatch({ type: 'dismiss_active' });
    },
    [patchAlert]
  );

  /** Alternate flow C: signal-drift false positive, dismissed with notes. */
  const markFalseAlarm = useCallback(
    (alertId, notes) => {
      const alert = stateRef.current.alerts.find((item) => item.alertId === alertId);
      if (!alert) return;
      patchAlert(
        alertId,
        {
          status: ALERT_STATUS.DISMISSED,
          handledBy: OFFICER.officerId,
          handledAt: new Date(),
          notes: notes || 'Stationary collar signal drift.'
        },
        createAuditEntry({
          action: AUDIT_ACTION.MARKED_FALSE_ALARM,
          alert,
          actor: OFFICER.officerId,
          detail: notes || 'Stationary collar signal drift.',
        })
      );
      dispatch({ type: 'toast', toast: { kind: 'info', title: 'Alert dismissed', body: 'Logged as false alarm' } });
      dispatch({ type: 'dismiss_active' });
    },
    [patchAlert]
  );

  /** Alternate flow D: officer decides a delayed breach needs a patrol check. */
  const decideDelayedPatrolCheck = useCallback(
    async (alertId) => {
      const alert = stateRef.current.alerts.find((item) => item.alertId === alertId);
      if (!alert) return null;

      const ranger = findNearestRanger(alert.position, RANGERS);
      patchAlert(
        alertId,
        { status: ALERT_STATUS.ACKNOWLEDGED, handledBy: OFFICER.officerId, handledAt: new Date(), dispatchState: 'sending' },
        createAuditEntry({
          action: AUDIT_ACTION.PATROL_CHECK_DISPATCHED,
          alert,
          actor: OFFICER.officerId,
          detail: 'Delayed incident accepted; retroactive patrol check dispatched.',
        })
      );

      const outcome = await notifierRef.current.sendDispatch(alert, ranger);
      const current = stateRef.current.alerts.find((item) => item.alertId === alertId);
      patchAlert(
        alertId,
        { dispatchState: outcome.delivered ? 'delivered' : 'failed', dispatchedTo: ranger?.name ?? null },
        createAuditEntry({
          action: outcome.delivered ? AUDIT_ACTION.RANGER_DISPATCHED : AUDIT_ACTION.DISPATCH_FAILED,
          alert: current ?? alert,
          actor: 'NotificationService',
          detail: outcome.delivered
            ? `${ranger?.name ?? 'Ranger team'} tasked with delayed patrol check.`
            : 'Dispatch failed after 3 retries. Use radio.',
        })
      );
      dispatch({
        type: 'toast',
        toast: outcome.delivered
          ? { kind: 'success', title: 'Patrol check', body: 'Response Team Dispatched', alertId }
          : { kind: 'error', title: 'Dispatch failed', body: 'Failed delivery - contact ranger team by radio', alertId }
      });
      return outcome;
    },
    [patchAlert]
  );

  const dismissToast = useCallback(() => dispatch({ type: 'toast', toast: null }), []);
  const clearSignalLost = useCallback(() => dispatch({ type: 'signal_lost_clear' }), []);

  /** Forces the gateway fault from exception flow 1 for demo purposes. */
  const simulateSignalLost = useCallback((collarId = 'E-207') => {
    dispatch({
      type: 'signal_lost',
      collarId,
      audit: createAuditEntry({
        action: AUDIT_ACTION.SIGNAL_LOST,
        alert: null,
        actor: 'CollarGateway',
        detail: `Telemetry link lost for ${collarId}: Gateway heartbeat timeout.`,
        at: new Date()
      })
    });
  }, []);
  const setSessionExpired = useCallback(
    (value) => dispatch({ type: 'session_expired', value }),
    []
  );

  return {
    collars: state.collars,
    alerts: state.alerts,
    alertsByPriority,
    openAlerts,
    activeAlert,
    auditTrail: state.auditTrail,
    lostCollars: state.lostCollars,
    sessionExpired: state.sessionExpired,
    toast: state.toast,
    zones: HIGH_RISK_ZONES,
    rangerTeams: RANGERS,
    settlements: SETTLEMENTS,
    acknowledgeAndDispatch,
    monitorClosely,
    markFalseAlarm,
    decideDelayedPatrolCheck,
    selectAlert,
    closeAlert,
    dismissToast,
    clearSignalLost,
    simulateSignalLost,
    setSessionExpired
  };
}