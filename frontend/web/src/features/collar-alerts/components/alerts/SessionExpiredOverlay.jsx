/**
 * Exception flow 2 — the officer's session times out. On sign-in the
 * previous dashboard view and active alert queue are restored; if they
 * cannot be recovered the queue is refreshed from the database.
 */
export default function SessionExpiredOverlay({ open, onResume }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/70 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <svg className="mt-0.5 h-6 w-6 shrink-0 text-gold-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a4 4 0 0 1 4 4h-2a2 2 0 0 0-4 0H8a4 4 0 0 1 4-4Zm0 12a4 4 0 0 1-4-4h2a2 2 0 0 0 4 0h2a4 4 0 0 1-4 4Z" />
          </svg>
          <div>
            <h2 id="session-expired-title" className="text-base font-bold text-stone-900">
              Session expired
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              You were signed out after a period of inactivity. Sign in again to restore the dashboard view and
              active alert queue.
            </p>
          </div>
        </div>

        <label htmlFor="officer-pin" className="mt-5 block text-xs font-bold uppercase tracking-wide text-stone-500">
          Operations Officer PIN
        </label>
        <input
          id="officer-pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm
            focus:border-park-700 focus:outline-none focus:ring-1 focus:ring-park-700"
        />

        <button
          type="button"
          onClick={onResume}
          className="mt-5 w-full rounded-md bg-park-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-park-700"
        >
          Sign in and restore alert queue
        </button>
      </div>
    </div>
  );
}