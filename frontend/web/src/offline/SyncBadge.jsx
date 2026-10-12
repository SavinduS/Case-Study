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

export default SyncBadge;
