/**
 * Exception flow 1 — the collar network gateway drops, so the dashboard
 * flags Signal Lost and tells the officer to check hardware or the
 * satellite link.
 */
export default function SignalLostBanner({ collarIds, onDismiss }) {
  if (collarIds.length === 0) return null;

  return (
    <div
      role="alert"
      className="absolute left-1/2 top-4 z-[750] -translate-x-1/2 rounded-md border border-alert-600/40
        bg-alert-100 px-4 py-2.5 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <svg className="h-5 w-5 shrink-0 text-alert-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-2h2v2Zm0-4h-2V7h2v6Z" />
        </svg>
        <div>
          <p className="text-sm font-bold text-alert-600">Signal Lost</p>
          <p className="text-xs text-stone-700">
            Telemetry link lost for {collarIds.join(', ')}. Check gateway hardware or satellite link.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss signal lost warning"
          className="rounded p-1 text-stone-500 hover:bg-white/60"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}