import SoundControl from './SoundControl.jsx';
import { formatGmtStamp } from '../../domain/labels.js';

/**
 * The persistent critical alert banner.
 *
 * The modal is the primary notice, but it can be closed (acknowledged as seen)
 * and the alarm can be muted, so the queue still needs something red on screen
 * while the breach is open — an officer who looks away must be able to tell at
 * a glance that there is an unresolved critical alert.
 *
 * It stacks below the alert modal (z-1100 against the modal's z-1200) so it
 * never sits on top of the red header the officer is reading; the moment the
 * modal opens the banner steps aside, and it returns the moment it closes.
 */
export default function CriticalAlertBanner({
  alert,
  count = 0,
  alarm,
  onOpenAlert,
  onSilence
}) {
  if (!alert) return null;

  const others = Math.max(count - 1, 0);

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="critical-alert-banner"
      className="pointer-events-none absolute inset-x-3 top-3 z-[1100] flex flex-col gap-2 lg:left-14 lg:right-80"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-alert-600
        bg-alert-600 px-3 py-2 text-white shadow-xl lg:px-4 lg:py-2.5">
        <span className="flex h-7 w-7 shrink-0 animate-pulse items-center justify-center rounded-full bg-white/20">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2 1 21h22L12 2Zm0 4 7.5 13h-15L12 6Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z" />
          </svg>
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold uppercase tracking-wide">
            Critical boundary breach — asset {alert.collarId}
          </p>
          <p className="truncate text-xs text-white/85">
            {alert.species} · {alert.zoneName} · {alert.gridRef} · {formatGmtStamp(alert.detectedAt)}
            <span className="ml-1 uppercase">{alert.threatLevel}</span>
            {others > 0 && <span> · +{others} more open</span>}
          </p>
        </div>

        <SoundControl
          muted={alarm.muted}
          blocked={alarm.blocked}
          supported={alarm.supported}
          onToggleMuted={alarm.toggleMuted}
          onEnableSound={alarm.enableSound}
          className="shrink-0"
        />

        <button
          type="button"
          onClick={() => onOpenAlert?.(alert.alertId)}
          className="shrink-0 rounded border border-white/60 px-2 py-1 text-[11px] font-semibold
            text-white hover:bg-white/20"
        >
          Open
        </button>
        {/* Silences the notification only. It never resolves or dismisses the
            incident — that is still an explicit officer action in the modal. */}
        <button
          type="button"
          onClick={onSilence}
          aria-label="Silence this alert notification"
          title="Hide this notification. The incident stays open."
          className="shrink-0 rounded p-1 hover:bg-white/20"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}