import Badge from '../../../../components/ui/Badge.jsx';

const STATUS_TONE = {
  active: 'low',
  delayed: 'medium',
  signal_lost: 'high'
};

const STATUS_LABEL = {
  active: 'Transmitting',
  delayed: 'Delayed batch',
  signal_lost: 'Signal lost'
};

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
      className="absolute right-0 top-0 z-[800] flex h-full w-80 flex-col border-l border-stone-200 bg-white shadow-xl"
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
                <Badge tone={STATUS_TONE[collar.status]} size="sm">
                  {STATUS_LABEL[collar.status]}
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
                {collar.position[1].toFixed(4)} N, {collar.position[0].toFixed(4)} E
              </p>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}