import useOfflineSync from './useOfflineSync.js';

/**
 * "Pending sync" / "Failed" badge for the incident list.
 *
 * Usage in an incident list row:
 *   const queued = queueByClientId[row.clientId];
 *   {queued && <SyncBadge status={queued.status} onRetry={syncNow} />}
 *
 * Server-confirmed rows render nothing (pass no status).
 */
export function SyncBadge({ status, onRetry, error }) {
  if (status === 'pending') {
    return (
      <span
        role="status"
        title="Saved on this device, waiting for a connection"
        className="inline-flex items-center rounded border border-gold-500/50 bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-500"
      >
        Pending sync
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          role="alert"
          title={error ?? 'Last sync attempt failed'}
          className="inline-flex items-center rounded border border-alert-600/40 bg-alert-100 px-2 py-0.5 text-[11px] font-bold text-alert-600"
        >
          Failed
        </span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px] font-semibold text-stone-700 hover:bg-white"
          >
            Retry
          </button>
        )}
      </span>
    );
  }
  return null;
}

/**
 * Small online/offline strip for the top of the app. Reads the hook itself
 * when no props are given, so `<OfflineBanner />` alone is enough in App.
 */
export function OfflineBanner(props = {}) {
  const fallback = useOfflineSync();
  const isOnline = props.isOnline ?? fallback.isOnline;
  const pendingCount = props.pendingCount ?? fallback.pendingCount;
  const onRetry = props.onRetry ?? fallback.syncNow;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex h-7 shrink-0 items-center justify-center gap-2 px-4 text-xs font-semibold ${
        isOnline ? 'bg-park-100 text-park-800' : 'bg-gold-100 text-gold-500'
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-2 w-2 rounded-full ${isOnline ? 'bg-moss-500' : 'bg-gold-500'}`}
      />
      {isOnline ? 'Online' : 'Offline — reports stay on this device'}
      {pendingCount > 0 && (
        <>
          <span aria-label={`${pendingCount} report${pendingCount === 1 ? '' : 's'} pending sync`}>
            · {pendingCount} pending
          </span>
          {isOnline && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded border border-current px-1.5 py-px text-[11px] font-bold hover:bg-white/50"
            >
              Sync now
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default SyncBadge;
