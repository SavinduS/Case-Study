import Badge from '../../../../components/ui/Badge.jsx';
import { THREAT_LEVEL, THREAT_TONE, zoneKindShort } from '../../domain/labels.js';

/**
 * Geofence register — the pre-configured high-risk zones that are a
 * precondition of the use case. The officer can show or hide the overlay
 * per zone without leaving the map.
 */
export default function GeofencePanel({ zones, openAlertCounts, visibleZoneIds, onToggleZone, onToggleAll }) {
  const allVisible = visibleZoneIds.length === zones.length;

  return (
    <section
      aria-label="Geofences"
      className="absolute right-0 top-0 z-[800] flex h-full w-80 flex-col border-l border-stone-200 bg-white shadow-xl"
    >
      <header className="flex items-center gap-2 border-b border-stone-200 bg-park-800 px-4 py-3 text-white">
        <h2 className="text-sm font-bold uppercase tracking-wide">High-Risk Geofences</h2>
        <button
          type="button"
          onClick={onToggleAll}
          className="ml-auto text-[11px] font-semibold underline underline-offset-2 hover:text-white/80"
        >
          {allVisible ? 'Hide all' : 'Show all'}
        </button>
      </header>

      <ul className="flex-1 overflow-y-auto">
        {zones.map((zone) => {
          const isVisible = visibleZoneIds.includes(zone.zoneId);
          const breachCount = openAlertCounts[zone.zoneId] ?? 0;

          return (
            <li key={zone.zoneId} className="border-b border-stone-200 px-4 py-3">
              <div className="flex items-center gap-2">
                <Badge tone={THREAT_TONE[zone.threatLevel]} size="sm">
                  {zone.threatLevel}
                </Badge>
                <span className="font-mono text-[11px] text-stone-500">{zone.gridRef}</span>
                {breachCount > 0 && (
                  <span className="ml-auto rounded bg-alert-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {breachCount} BREACH
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm font-semibold text-stone-900">{zone.name}</p>
              <p className="text-xs text-stone-600">{zoneKindShort(zone.kind)}</p>

              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-stone-700">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={() => onToggleZone(zone.zoneId)}
                  className="accent-park-700"
                />
                Show on map
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}