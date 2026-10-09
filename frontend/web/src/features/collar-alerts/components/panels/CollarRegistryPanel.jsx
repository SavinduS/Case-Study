import Badge from '../../../../components/ui/Badge.jsx';
import { COLLAR_STATUS_LABEL, COLLAR_STATUS_TONE } from '../../domain/labels.js';

/**
 * Tracked collar registry — the WildlifeCollar entities from the class
 * diagram. An officer uses this to see which assets are reporting, which
 * are overdue, and which have a flat battery before a breach occurs.
 */
export default function CollarRegistryPanel({ collars, onFocusCollar }) {
  const ordered = [...collars].sort((a, b) => {
    const rank = (c) => (c.status === 'signal_lost' ? 0 : c.status === 'delayed' ? 1 : 2);
    return rank(a) - rank(b) || a.batteryLevel - b.batteryLevel;
  });

  return (
    <section
      aria-label="Tracked collars"
      className="fixed inset-x-0 bottom-0 z-[800] flex max-h-[75vh] flex-col rounded-t-2xl
        border-t border-stone-200 bg-white shadow-2xl
        lg:absolute lg:inset-y-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-none
        lg:w-80 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-xl"
    >
      <header className="flex items-center gap-2 border-b border-stone-200 bg-park-800 px-4 py-3 text-white">
        <h2 className="text-sm font-bold uppercase tracking-wide">Tracked Collars</h2>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{collars.length}</span>
      </header>

      <ul className="flex-1 overflow-y-auto">
        {ordered.map((collar) => (
          <li key={collar.collarId}>
            <button
              type="button"
              onClick={() => onFocusCollar(collar)}
              className="w-full border-b border-stone-200 px-4 py-3 text-left transition-colors hover:bg-park-50"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-stone-900">{collar.collarId}</span>
                <Badge tone={COLLAR_STATUS_TONE[collar.status]} size="sm">
                  {COLLAR_STATUS_LABEL[collar.status] ?? collar.status}
                </Badge>
              </div>

              <p className="mt-1 truncate text-xs text-stone-600">
                {collar.species} · {collar.sex}
              </p>

              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-stone-500">
                <div className="flex justify-between">
                  <dt>Device</dt>
                  <dd className="font-mono text-stone-700">{collar.gpsDeviceId}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Health</dt>
                  <dd className="text-stone-700">{collar.health}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Battery</dt>
                  <dd
                    className={
                      collar.batteryLevel <= 20 ? 'font-bold text-alert-600' : 'text-stone-700'
                    }
                  >
                    {collar.batteryLevel}%
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Risk</dt>
                  <dd className="capitalize text-stone-700">{collar.speciesRisk}</dd>
                </div>
              </dl>

              <p className="mt-1.5 font-mono text-[10px] text-stone-400">
                {collar.lastKnownLocation.coordinates[1].toFixed(4)} N,{' '}
                {collar.lastKnownLocation.coordinates[0].toFixed(4)} E
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}