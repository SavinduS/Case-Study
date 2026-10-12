import { useMemo, useState } from 'react';
import Button from '../../../../components/ui/Button.jsx';
import Badge from '../../../../components/ui/Badge.jsx';
import { ALERT_STATUS, AUDIT_TAB, formatGmtStamp } from '../../domain/labels.js';

/**
 * OperationsDrawer — the review surface for the two record-keeping parts of
 * the use case: retroactive "Delayed Incident" breaches (alternate flow D)
 * and the wildlife monitoring audit trail (main flow step 12).
 *
 * The third tab is the ranger dispatch log, so a requested dispatch, the
 * attempts that were delivered and the ones that failed are all inspectable
 * from the same place (exception flow 3).
 */
export default function OperationsDrawer({
  open,
  onClose,
  delayedAlerts,
  auditTrail,
  dispatchAttempts = [],
  onDispatchPatrolCheck,
  onSelectAlert
}) {
  const [tab, setTab] = useState(AUDIT_TAB.DELAYED);

  const delayedCount = useMemo(
    () => delayedAlerts.filter((alert) => alert.status === ALERT_STATUS.DELAYED).length,
    [delayedAlerts]
  );

  const failedDispatches = useMemo(
    () => dispatchAttempts.filter((attempt) => attempt.state === 'failed'),
    [dispatchAttempts]
  );

  if (!open) return null;

  const TABS = [
    { key: AUDIT_TAB.DELAYED, label: 'Delayed incidents', count: delayedCount || null },
    { key: AUDIT_TAB.DISPATCH, label: 'Dispatch log', count: failedDispatches.length || null },
    { key: AUDIT_TAB.AUDIT, label: 'Audit trail', count: auditTrail.length || null }
  ];

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
        {TABS.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wide ${
              tab === key ? 'border-b-2 border-alert-600 text-alert-600' : 'text-stone-500'
            }`}
          >
            {label} {count !== null && <span className="ml-1">({count})</span>}
          </button>
        ))}
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
        ) : tab === AUDIT_TAB.DISPATCH ? (
          dispatchAttempts.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-stone-500">
              No ranger dispatch has been made for this session.
            </p>
          ) : (
            <ul>
              {dispatchAttempts.map((attempt) => (
                <li
                  key={attempt._id ?? `${attempt.alertId}-${attempt.attempt}`}
                  className="border-b border-stone-100 px-4 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-park-800">
                      {attempt.alertId}
                    </span>
                    <Badge tone={attempt.state === 'delivered' ? 'low' : 'high'} size="sm">
                      {attempt.state === 'delivered' ? 'Delivered' : attempt.state === 'failed' ? 'Failed delivery' : 'Sending'}
                    </Badge>
                    <span className="ml-auto font-mono text-[11px] text-stone-500">
                      attempt {attempt.attempt}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-stone-600">
                    {attempt.rangerName ?? 'No ranger team selected'}
                    {attempt.error ? ` — ${attempt.error}` : ''}
                  </p>
                </li>
              ))}
              {failedDispatches.length > 0 && (
                <li className="bg-alert-100 px-4 py-2.5 text-xs font-semibold text-alert-600">
                  {failedDispatches.length} dispatch attempt(s) failed after 3 retries. Contact the ranger team by
                  radio.
                </li>
              )}
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