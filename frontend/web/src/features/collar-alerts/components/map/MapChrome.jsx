import { useEffect, useState } from 'react';

/** Live park clock, top-left of the map. */
export function ClockChip({ time }) {
  return (
    <div className="pointer-events-none absolute left-16 top-4 z-[700] rounded-md bg-white/95 px-3 py-1.5 shadow">
      <span className="font-mono text-lg font-semibold leading-none text-stone-800">{time}</span>
    </div>
  );
}

/**
 * Telemetry + boundary status chips. "Data Ingestion Active" mirrors the
 * storyboard frame where a transmission is being received.
 */
export function StatusChips({ signalLost = false, boundaryVisible = true, onToggleBoundary }) {
  return (
    <div className="pointer-events-none absolute right-[22.5rem] top-4 z-[700] flex flex-col items-end gap-2">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow">
        <span className={`h-2 w-2 rounded-full ${signalLost ? 'bg-alert-600' : 'bg-moss-500'}`} />
        {signalLost ? 'Data Ingestion Interrupted' : 'Data Ingestion Active'}
      </span>
      <button
        type="button"
        onClick={onToggleBoundary}
        aria-pressed={boundaryVisible}
        className="pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold shadow
          border transition-colors"
        style={{
          background: boundaryVisible ? '#d7263d' : '#ffffff',
          color: boundaryVisible ? '#ffffff' : '#b91c1c',
          borderColor: '#d7263d'
        }}
      >
        <span className="h-2 w-2 rounded-full bg-current" />
        High-Risk Boundary
      </button>
    </div>
  );
}

const CONTROLS = [
  { key: 'settings', label: 'Map settings', path: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z' },
  { key: 'locate', label: 'Centre on breach', path: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6 3 3h-2v3h-2V5H9l3-3Z' },
  { key: 'fit', label: 'Fit park bounds', path: 'M4 4h6v2H6v4H4V4Zm10 0h6v6h-2V6h-4V4ZM4 14h2v4h4v2H4v-6Zm14 0h2v6h-6v-2h4v-4Z' },
  { key: 'fullscreen', label: 'Toggle fullscreen', path: 'M4 9V4h5v2H6v3H4Zm11-5h5v5h-2V6h-3V4ZM4 15h2v3h3v2H4v-5Zm14 0h2v5h-5v-2h3v-3Z' }
];

/** Right-hand control stack from the high-fidelity wireframe. */
export function ControlStack({ onAction }) {
  return (
    <div className="absolute right-[22.5rem] top-4 z-[700] flex flex-col gap-2">
      {CONTROLS.map((control) => (
        <button
          key={control.key}
          type="button"
          title={control.label}
          aria-label={control.label}
          onClick={() => onAction?.(control.key)}
          className="grid h-9 w-9 place-items-center rounded-md bg-white/95 text-park-900 shadow transition-colors hover:bg-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={control.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Ticking clock used by the map chrome. */
export function useClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now.toLocaleTimeString('en-GB', { hour12: false });
}