import { useEffect } from 'react';

const TONE = {
  success: { ring: 'ring-moss-500', badge: 'bg-moss-500', title: 'text-park-900' },
  info: { ring: 'ring-park-700', badge: 'bg-park-700', title: 'text-park-900' },
  error: { ring: 'ring-alert-600', badge: 'bg-alert-600', title: 'text-alert-600' }
};

/**
 * Confirmation toast shown after an officer action — the green
 * "Addressed / Response Team Dispatched" card from the final
 * storyboard frame.
 */
export default function DispatchToast({ toast, onDismiss, timeoutMs = 6000 }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDismiss, timeoutMs);
    return () => clearTimeout(timer);
  }, [toast, onDismiss, timeoutMs]);

  if (!toast) return null;

  const tone = TONE[toast.kind] ?? TONE.info;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute bottom-4 right-[22.5rem] z-[800] w-64 rounded-md bg-white p-3 shadow-xl ring-2 ${tone.ring}`}
    >
      <div className="flex items-start gap-2">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ${tone.badge}`}>
          <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="m7.5 13.5 5-5 1.5 1.5-6.5 6.5L3 12l1.5-1.5 3 3Z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${tone.title}`}>{toast.title}</p>
          <p className="text-xs text-stone-600">{toast.body}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="rounded p-0.5 text-stone-400 hover:bg-stone-100"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
          </svg>
        </button>
      </div>
    </div>
  );
}