import { useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import Badge from '../../../../components/ui/Badge.jsx';
import AlertMiniMap from './AlertMiniMap.jsx';
import FalseAlarmDialog from './FalseAlarmDialog.jsx';
import DispatchDialog from './DispatchDialog.jsx';
import { ALERT_STATUS, THREAT_LEVEL, THREAT_TONE, ZONE_KIND_LABEL, formatGmt } from '../../domain/labels.js';

/**
 * CriticalAlertModal — the instant visual + acoustic alert raised when the
 * GeofenceEngine detects a boundary breach (main flow steps 4-10).
 *
 * Layout follows the high-fidelity wireframe: red header bar, mini map and
 * asset facts on the left, breach facts on the right, and the two response
 * actions in the footer.
 */
export default function CriticalAlertModal({
  alert,
  zone,
  rangerTeams,
  onAcknowledgeDispatch,
  onDispatchPatrolCheck,
  onMonitor,
  onFalseAlarm,
  onClose
}) {
  const [showFalseAlarm, setShowFalseAlarm] = useState(false);
  const [showDispatch, setShowDispatch] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!alert) return null;

  const isDelayed = alert.status === ALERT_STATUS.DELAYED;

  const onConfirmDispatch = async () => {
    setBusy(true);
    await onAcknowledgeDispatch(alert.alertId);
    setBusy(false);
    setShowDispatch(false);
  };

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
            className={`flex items-center gap-3 px-6 py-3 text-white ${
              isDelayed ? 'bg-gold-500' : 'bg-alert-600'
            }`}
          >
            <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2 1 21h22L12 2Zm0 4 7.5 13h-15L12 6Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
            </svg>
            <h2 id="critical-alert-title" className="text-lg font-extrabold uppercase tracking-wide">
              {isDelayed ? 'Delayed Incident' : 'Critical Alert'}: Boundary Breach Detected (Asset {alert.collarId})
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close alert"
              className="ml-auto rounded p-1 hover:bg-white/20"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
              </svg>
            </button>
          </header>

          <div className="grid gap-6 px-6 py-5 md:grid-cols-2">
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
                      {ZONE_KIND_LABEL[zone?.kind] ?? 'High-Risk Zone'}
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

          <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
            {isDelayed ? (
              <span className="mr-auto text-xs text-stone-600">
                Reconstructed from a delayed telemetry batch. Decide whether a patrol check is required.
              </span>
            ) : (
              <span className="mr-auto text-xs text-stone-600">
                Actions are written to the wildlife monitoring audit trail.
              </span>
            )}
            <Button variant="outline" onClick={() => setShowFalseAlarm(true)}>
              Dismiss &amp; Log
            </Button>
            {isDelayed ? (
              <Button variant="primary" disabled={busy} onClick={() => onDispatchPatrolCheck(alert.alertId)}>
                Dispatch Patrol Check
              </Button>
            ) : (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => setShowDispatch(true)}
                data-testid="acknowledge-dispatch"
              >
                Acknowledge &amp; Dispatch Ranger
              </Button>
            )}
            <Button variant="ghost" onClick={onMonitor}>
              Monitor Closely
            </Button>
          </footer>
        </div>
      </Modal>

      <FalseAlarmDialog
        open={showFalseAlarm}
        alert={alert}
        onCancel={() => setShowFalseAlarm(false)}
        onConfirm={(notes) => {
          onFalseAlarm(alert.alertId, notes);
          setShowFalseAlarm(false);
        }}
      />

      <DispatchDialog
        open={showDispatch}
        alert={alert}
        rangerTeams={rangerTeams}
        busy={busy}
        onCancel={() => setShowDispatch(false)}
        onConfirm={onConfirmDispatch}
      />
    </>
  );
}