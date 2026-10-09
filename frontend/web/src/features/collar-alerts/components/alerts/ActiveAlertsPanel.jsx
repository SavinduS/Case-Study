import Badge from '../../../../components/ui/Badge.jsx';
import { ALERT_STATUS, THREAT_LEVEL } from '../../domain/constants.js';

const STATUS_LABEL = {
  [ALERT_STATUS.ACTIVE]: 'Active',
  [ALERT_STATUS.ACKNOWLEDGED]: 'Acknowledged',
  [ALERT_STATUS.RESOLVED]: 'Resolved',
  [ALERT_STATUS.DISMISSED]: 'False alarm',
  [ALERT_STATUS.DELAYED]: 'Delayed incident'
};

const STATUS_TONE = {
  [ALERT_STATUS.ACTIVE]: 'high',
  [ALERT_STATUS.ACKNOWLEDGED]: 'medium',
  [ALERT_STATUS.RESOLVED]: 'low',
  [ALERT_STATUS.DISMISSED]: 'neutral',
  [ALERT_STATUS.DELAYED]: 'medium'
};

const THREAT_TONE = {
  [THREAT_LEVEL.CRITICAL]: 'high',
  [THREAT_LEVEL.HIGH]: 'high',
  [THREAT_LEVEL.MEDIUM]: 'medium',
  [THREAT_LEVEL.LOW]: 'low'
};

function formatGmt(value) {
  return new Date(value).toLocaleTimeString('en-GB', { hour12: false, timeZone: 'GMT' });
}

/**
 * ActiveAlertsPanel — the "Active Alerts" section the officer navigates to
 * after the critical alert fires (main flow step 5).
 *
 * Rows are ordered by GeofenceEngine priority (threat level, proximity to
 * settlements, animal risk) so that simultaneous breaches are handled
 * highest-first (alternate flow B).
 */
export default function ActiveAlertsPanel({ alerts, openCount, onSelect, selectedAlertId }) {
  return (
    <section
      aria-label="Active alerts queue"
      className="absolute right-0 top-0 z-[800] flex h-full w-80 flex-col
        border-l border-stone-200 bg-white shadow-xl"
    >
      <header className="flex items-center gap-2 border-b border-stone-200 bg-park-800 px-4 py-3 text-white">
        <h2 className="text-sm font-bold uppercase tracking-wide">Active Alerts</h2>
        <span className="ml-auto rounded-full bg-alert-600 px-2 py-0.5 text-xs font-bold">{openCount}</span>
      </header>

      {alerts.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-stone-500">
          No boundary alerts. All tracked animals are inside authorised ranges.
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {alerts.map((alert, index) => (
            <li key={alert.alertId}>
              <button
                type="button"
                onClick={() => onSelect(alert.alertId)}
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
                  <Badge tone={STATUS_TONE[alert.status]} size="sm">
                    {STATUS_LABEL[alert.status]}
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