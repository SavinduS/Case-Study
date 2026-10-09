import { useEffect, useRef, useState } from 'react';
import Badge from '../../../../components/ui/Badge.jsx';
import {
  ALERT_STATUS,
  ALERT_STATUS_LABEL,
  ALERT_STATUS_TONE,
  THREAT_TONE,
  formatGmt
} from '../../domain/labels.js';
import useIsDesktop from '../../hooks/useIsDesktop.js';

/**
 * ActiveAlertsPanel — the "Active Alerts" section the officer navigates to
 * after the critical alert fires (main flow step 5).
 *
 * Layout is mobile-first:
 *   - phone  : a bottom sheet. Collapsed it shows the open count and the
 *              highest priority alert, so the map stays visible. It expands
 *              to a scrollable list and can be dragged closed.
 *   - md and up : the persistent right-hand column from the high-fidelity
 *              wireframe, unchanged.
 *
 * Rows are ordered by the server's priority score, so simultaneous breaches
 * are handled highest-first (alternate flow B).
 */
export default function ActiveAlertsPanel({ alerts, openCount, onSelect, selectedAlertId }) {
  const isDesktop = useIsDesktop();
  const [expanded, setExpanded] = useState(false);
  const sheetRef = useRef(null);

  // The sheet is a phone affordance; make sure it is collapsed when the
  // layout switches to the desktop column.
  useEffect(() => {
    if (isDesktop) setExpanded(false);
  }, [isDesktop]);

  // Escape closes the sheet, matching the modals elsewhere in the dashboard.
  useEffect(() => {
    if (!expanded || isDesktop) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [expanded, isDesktop]);

  const top = alerts[0];

  const select = (alertId) => {
    onSelect(alertId);
    if (!isDesktop) setExpanded(false);
  };

  return (
    <section
      ref={sheetRef}
      aria-label="Active alerts queue"
      data-expanded={expanded}
      className={[
        // Phone: fixed sheet pinned to the bottom of the viewport.
        'fixed inset-x-0 bottom-0 z-[800] flex flex-col',
        'rounded-t-2xl border-t border-stone-200 bg-white shadow-2xl',
        'transition-transform duration-200 ease-out',
        expanded ? 'translate-y-0' : 'translate-y-[calc(100%-3.25rem)]',
        // md and up: the wireframe's right-hand column.
        'lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-80',
        'lg:translate-y-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-xl'
      ].join(' ')}
    >
      <button
        type="button"
        onClick={() => !isDesktop && setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-controls="active-alerts-list"
        className="shrink-0 cursor-pointer rounded-t-2xl pt-2 lg:hidden"
      >
        <span className="mx-auto block h-1 w-10 rounded-full bg-stone-300" aria-hidden="true" />
        <span className="mt-1.5 flex items-center justify-between gap-2 px-4 pb-2">
          <span className="text-sm font-bold uppercase tracking-wide text-stone-800">
            Active Alerts
          </span>
          <span className="flex items-center gap-2">
            {top && (
              <span className="truncate text-xs text-stone-500">
                {top.collarId} · {ALERT_STATUS_LABEL[top.status]}
              </span>
            )}
            <span className="rounded-full bg-alert-600 px-2 py-0.5 text-xs font-bold text-white">
              {openCount}
            </span>
            <svg
              className={`h-4 w-4 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5.5 12.5 10 8l4.5 4.5H5.5Z" />
            </svg>
          </span>
        </span>
      </button>

      <header className="hidden items-center gap-2 border-b border-stone-200 bg-park-800 px-4 py-3 text-white lg:flex">
        <h2 className="text-sm font-bold uppercase tracking-wide">Active Alerts</h2>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{openCount}</span>
      </header>

      {alerts.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-stone-500">
          No boundary alerts. All tracked animals are inside authorised ranges.
        </p>
      ) : (
        <ul id="active-alerts-list" className="flex-1 overflow-y-auto overscroll-contain">
          {alerts.map((alert, index) => (
            <li key={alert.alertId}>
              <button
                type="button"
                onClick={() => select(alert.alertId)}
                aria-current={selectedAlertId === alert.alertId ? 'true' : undefined}
                className={`w-full border-b border-stone-200 px-4 py-3 text-left transition-colors
                  hover:bg-park-50 ${selectedAlertId === alert.alertId ? 'bg-park-50' : ''}`}
              >
                <div className="flex items-center gap-2">
                  {index === 0 && openCount > 1 && (
                    <span className="rounded bg-alert-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                      Priority
                    </span>
                  )}
                  <span className="text-sm font-bold text-stone-900">{alert.collarId}</span>
                  <Badge tone={THREAT_TONE[alert.threatLevel]} size="sm">
                    {alert.threatLevel}
                  </Badge>
                  <span className="ml-auto font-mono text-[11px] text-stone-500">
                    {formatGmt(alert.detectedAt)}
                  </span>
                </div>

                <p className="mt-1 truncate text-xs text-stone-600">
                  {alert.species} · {alert.zoneName} · {alert.gridRef}
                </p>

                <div className="mt-2 flex items-center gap-2">
                  <Badge tone={ALERT_STATUS_TONE[alert.status]} size="sm">
                    {ALERT_STATUS_LABEL[alert.status]}
                  </Badge>
                  {alert.dispatchedTo && (
                    <span className="truncate text-[11px] text-stone-500">{alert.dispatchedTo}</span>
                  )}
                  {alert.dispatchState === 'failed' && (
                    <span className="text-[11px] font-semibold text-alert-600">Failed delivery</span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}