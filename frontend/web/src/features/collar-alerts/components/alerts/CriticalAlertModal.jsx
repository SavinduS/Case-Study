import { useEffect, useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Badge from '../../../../components/ui/Badge.jsx';
import AlertMiniMap from './AlertMiniMap.jsx';
import FalseAlarmDialog from './FalseAlarmDialog.jsx';
import DispatchDialog from './DispatchDialog.jsx';
import { ALERT_STATUS, THREAT_TONE, formatGmt, formatGmtStamp, zoneKindLabel } from '../../domain/labels.js';

/**
 * CriticalAlertModal — the instant visual + audible alert raised when the
 * GeofenceEngine detects a boundary breach (main flow steps 4-10).
 *
 * Layout follows the high-fidelity wireframe: red header bar, mini map and
 * asset facts on the left, breach facts on the right, and the response actions
 * in the footer.
 */
export default function CriticalAlertModal({
  alert,
  zone,
  rangerTeams,
  dispatchAttempts: dispatchAttemptsProp,
  responding = null,
  onLoadDispatchAttempts,
  onAcknowledgeDispatch,
  onDispatchPatrolCheck,
  onMonitor,
  onFalseAlarm,
  onClose
}) {
  const [showFalseAlarm, setShowFalseAlarm] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempts, setAttempts] = useState(dispatchAttemptsProp ?? []);

  // The retry log is fetched when the alert changes, so a dispatch that failed
  // earlier in the shift is explained rather than just labelled "failed".
  useEffect(() => {
    setAttempts(dispatchAttemptsProp ?? []);
    if (!alert?.alertId || !onLoadDispatchAttempts) return;
    let cancelled = false;
    onLoadDispatchAttempts(alert.alertId).then((loaded) => {
      if (!cancelled) setAttempts(loaded ?? []);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert?.alertId]);

  if (!alert) return null;

  const isDelayed = alert.status === ALERT_STATUS.DELAYED;
  // A response already in flight disables every action, so a second click
  // cannot send a duplicate dispatch request.
  const locked = busy || responding !== null;

  const onConfirmDispatch = async () => {
    setBusy(true);
    try {
      await onAcknowledgeDispatch(alert.alertId);
    } catch {
      // The hook has already raised the error toast; keep the dialog open so
      // the officer can retry rather than believing it went through.
    } finally {
      setBusy(false);
      setShowDispatch(false);
    }
  };

  const onConfirmFalseAlarm = async (notes) => {
    setBusy(true);
    try {
      await onFalseAlarm(alert.alertId, notes);
      setShowFalseAlarm(false);
    } catch {
      // Same: the dialog stays open on failure.
    } finally {
      setBusy(false);
    }
  };

  const failedDispatch = alert.dispatchState === 'failed';
  const attemptsForAlert = attempts.filter((attempt) => attempt.alertId === alert.alertId);

  return (
    <>
      <Modal
        open
        onClose={onClose}
        labelledBy="critical-alert-title"
        width="max-w-3xl"
      >
        {/* Role="alert" announces the new critical alert immediately. */}
        <div role="alert" aria-live="assertive">
          <header
            className={`flex items-start gap-2.5 px-4 py-3 text-white sm:items-center sm:gap-3 sm:px-6 ${
              isDelayed ? 'bg-gold-500' : 'bg-alert-600'
            }`}
          >
            <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 1 21h22L12 2Zm0 4 7.5 13h-15L12 6Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
            </svg>
            <h2 id="critical-alert-title" className="text-sm font-extrabold uppercase leading-snug tracking-wide sm:text-lg">
              {isDelayed ? 'Delayed Incident' : 'Critical Alert'}: Boundary Breach Detected (Asset {alert.collarId})
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alert"
              title="Close this dialog. The incident stays open."
              className="ml-auto rounded p-1 hover:bg-white/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
              </svg>
            </button>
          </header>

          <div className="grid gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-5 md:grid-cols-2">
            <div>
              <AlertMiniMap zone={zone} position={alert.position} />
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Asset</dt>
                  <dd className="text-sm font-semibold text-stone-800">
                    {alert.species} ID {alert.collarId}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Species</dt>
                  <dd className="text-sm font-semibold text-stone-800">{alert.species}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Last known health</dt>
                  <dd className="text-sm font-semibold text-stone-800">{alert.health}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Reference</dt>
                  <dd className="font-mono text-sm font-semibold text-stone-800">{alert.alertId}</dd>
                </div>
              </dl>
            </div>

            <div>
              <dl className="space-y-4">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Breach time</dt>
                  <dd className="text-base font-semibold text-stone-900">{formatGmt(alert.detectedAt)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Threat level</dt>
                  <dd className="mt-1 flex items-center gap-2">
                    <Badge tone={THREAT_TONE[alert.threatLevel]}>{alert.threatLevel}</Badge>
                    <span className="text-sm font-medium text-stone-700">
                      {zoneKindLabel(zone?.kind)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Location</dt>
                  <dd className="text-base font-semibold text-stone-900">
                    {zone?.name} · Grid Ref {alert.gridRef}
                  </dd>
                  <dd className="mt-0.5 font-mono text-xs text-stone-500">
                    {alert.position[1].toFixed(4)} N, {alert.position[0].toFixed(4)} E
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Alert details</dt>
                  <dd className="text-sm leading-relaxed text-stone-700">{alert.details}</dd>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                  <span>Nearest settlement {Math.round(alert.distanceToSettlementM / 100) / 10} km</span>
                  <span>Depth inside zone {alert.depthInsideM} m</span>
                </div>
              </dl>
            </div>
          </div>

          {failedDispatch && (
            <section
              role="alert"
              className="mx-4 mb-4 rounded-md border border-alert-600/50 bg-alert-100 p-3 sm:mx-6"
            >
              <h3 className="text-sm font-bold text-alert-600">Failed Delivery</h3>
              <p className="mt-1 text-xs text-stone-700">
                The ranger mobile unit did not acknowledge the dispatch after {alert.dispatchAttempts} attempts.
                Contact the ranger team by radio.
              </p>
              {attemptsForAlert.length > 0 && (
                <ol className="mt-2 space-y-1 text-[11px] text-stone-600">
                  {attemptsForAlert.map((attempt) => (
                    <li key={attempt._id ?? `${attempt.alertId}-${attempt.attempt}`}>
                      Attempt {attempt.attempt} — {attempt.state}
                      {attempt.rangerName ? ` · ${attempt.rangerName}` : ''}
                      {attempt.at ? ` · ${formatGmtStamp(attempt.at)}` : ''}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}

          {alert.dispatchState === 'delivered' && (
            <p className="mx-4 mb-4 rounded-md border border-moss-500/40 bg-park-50 p-3 text-xs text-park-800 sm:mx-6">
              Ranger team notified{alert.dispatchedTo ? `: ${alert.dispatchedTo}` : ''} after {alert.dispatchAttempts}{' '}
              attempt(s).
            </p>
          )}

          <footer className="flex flex-col gap-2 border-t border-stone-200 bg-stone-50 px-4 py-3 sm:flex-row
          sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
            {isDelayed ? (
              <span className="text-xs text-stone-600 sm:mr-auto">
                Reconstructed from a delayed telemetry batch. Decide whether a patrol check is required.
              </span>
            ) : (
              <span className="text-xs text-stone-600 sm:mr-auto">
                Actions are written to the wildlife monitoring audit trail.
              </span>
            )}
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              disabled={locked}
              onClick={() => setShowFalseAlarm(true)}
            >
              Dismiss &amp; Log
            </Button>
            {isDelayed ? (
              <Button
                className="w-full sm:w-auto"
                variant="primary"
                disabled={locked}
                onClick={() => onDispatchPatrolCheck(alert.alertId)}
              >
                Dispatch Patrol Check
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                variant="primary"
                disabled={locked}
                onClick={() => setShowDispatch(true)}
                data-testid="acknowledge-dispatch"
              >
                {responding === 'acknowledge_dispatch' ? 'Dispatching…' : 'Acknowledge & Dispatch Ranger'}
              </Button>
            )}
            <Button className="w-full sm:w-auto" variant="ghost" disabled={locked} onClick={() => onMonitor(alert.alertId)}>
              Monitor Closely
            </Button>
          </footer>
        </div>
      </Modal>

      <FalseAlarmDialog
        open={showFalseAlarm}
        alert={alert}
        busy={locked}
        onCancel={() => setShowFalseAlarm(false)}
        onConfirm={onConfirmFalseAlarm}
      />

      <DispatchDialog
        open={showDispatch}
        alert={alert}
        rangerTeams={rangerTeams}
        busy={locked}
        onCancel={() => setShowDispatch(false)}
        onConfirm={onConfirmDispatch}
      />
    </>
  );
}