import { useMemo, useState } from 'react';
import Button from '../../../../components/ui/Button.jsx';
import Badge from '../../../../components/ui/Badge.jsx';
import { ALERT_STATUS, AUDIT_TAB, formatGmtStamp } from '../../domain/labels.js';

/**
 * OperationsDrawer — the review surface for the two record-keeping parts of
 * the use case: retroactive "Delayed Incident" breaches (alternate flow D)
 * and the wildlife monitoring audit trail (main flow step 12).
 */
export default function OperationsDrawer({ open, onClose, delayedAlerts, auditTrail, onDispatchPatrolCheck, onSelectAlert }) {
  const [tab, setTab] = useState(AUDIT_TAB.DELAYED);

  const delayedCount = useMemo(
    () => delayedAlerts.filter((alert) => alert.status === ALERT_STATUS.DELAYED).length,
    [delayedAlerts]
  );

  if (!open) return null;

  return (
    <section
      aria-label="Operations records"
      className="absolute inset-x-3 top-16 z-[750] max-w-full rounded-lg bg-white shadow-2xl
        ring-1 ring-black/10 lg:left-16 lg:w-[26rem]"
    >
      <header className="flex items-center gap-2 border-b border-stone-200 px-4 py-2.5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-800">Operations Records</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close operations records"
          className="ml-auto rounded p-1 text-stone-400 hover:bg-stone-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
          </svg>
        </button>
      </header>

      <div role="tablist" aria-label="Records" className="flex gap-1 border-b border-stone-200 px-2">
        <button
          type="button"
          role="tab"
          aria-selected={tab === AUDIT_TAB.DELAYED}
          onClick={() => setTab(AUDIT_TAB.DELAYED)}
          className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${
            tab === AUDIT_TAB.DELAYED ? 'border-b-2 border-alert-600 text-alert-600' : 'text-stone-500'
          }`}
        >
          Delayed incidents {delayedCount > 0 && <span className="ml-1">({delayedCount})</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === AUDIT_TAB.AUDIT}
          onClick={() => setTab(AUDIT_TAB.AUDIT)}
          className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${
            tab === AUDIT_TAB.AUDIT ? 'border-b-2 border-alert-600 text-alert-600' : 'text-stone-500'
          }`}
        >
          Audit trail ({auditTrail.length})
        </button>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {tab === AUDIT_TAB.DELAYED ? (
          delayedAlerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-stone-500">
              No delayed telemetry. Every breach was detected on the live feed.
            </p>
          ) : (
            <ul>
              {delayedAlerts.map((alert) => (
                <li key={alert.alertId} className="border-b border-stone-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-900">{alert.collarId}</span>
                    <span className="font-mono text-[11px] text-stone-400">{alert.alertId}</span>
                    <Badge tone={alert.status === ALERT_STATUS.DELAYED ? 'medium' : 'low'} size="sm">
                      {alert.status === ALERT_STATUS.DELAYED ? 'Delayed' : 'Patrol check sent'}
                    </Badge>
                    <span className="ml-auto font-mono text-[11px] text-stone-500">{formatGmtStamp(alert.detectedAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-600">
                    Retroactive breach of {alert.zoneName} ({alert.gridRef}).
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onSelectAlert(alert.alertId)}>
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={alert.status !== ALERT_STATUS.DELAYED}
                      onClick={() => onDispatchPatrolCheck(alert.alertId)}
                    >
                      Dispatch patrol check
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : auditTrail.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-stone-500">No actions recorded yet.</p>
        ) : (
          <ul>
            {auditTrail.map((entry) => (
              <li key={entry.auditId} className="border-b border-stone-100 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold text-park-800">{entry.action}</span>
                  <span className="ml-auto font-mono text-[11px] text-stone-500">{formatGmtStamp(entry.at)}</span>
                </div>
                <p className="mt-0.5 text-xs text-stone-600">{entry.detail}</p>
                <p className="mt-0.5 text-[11px] text-stone-400">
                  {entry.alertId ?? '-'} · {entry.actor}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}