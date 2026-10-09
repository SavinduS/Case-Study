import { THREAT_LEVEL } from '../../domain/constants.js';

const LEGEND = [
  { key: 'boundary', label: 'Park Boundary', swatch: 'border-2 border-alert-600 bg-transparent' },
  { key: 'tracks', label: 'Animal Tracks', swatch: 'border-t-2 border-dashed border-park-700 bg-transparent' },
  { key: 'breach', label: 'Breach Point', swatch: 'h-2.5 w-2.5 rounded-full bg-alert-600' },
  { key: 'patrol', label: 'Ranger Patrols', swatch: 'h-2.5 w-2.5 rounded-sm bg-park-700' }
];

/** Bottom-left map legend from the storyboard frames. */
export default function MapLegend({ zones = [] }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-16 z-[700] rounded-md bg-white/95 p-3 shadow-lg">
      <ul className="space-y-1.5">
        {LEGEND.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-[11px] font-medium text-stone-700">
            <span className={`inline-block h-3 w-5 rounded-sm ${item.swatch}`} aria-hidden="true" />
            {item.label}
          </li>
        ))}
        {zones.map((zone) => (
          <li key={zone.zoneId} className="flex items-center gap-2 text-[11px] font-medium text-stone-700">
            <span
              className={`inline-block h-3 w-5 rounded-sm border ${
                zone.threatLevel === THREAT_LEVEL.CRITICAL ? 'border-alert-600 bg-alert-600/25' : 'border-gold-500 bg-gold-100'
              }`}
              aria-hidden="true"
            />
            {zone.name}
          </li>
        ))}
      </ul>
    </div>
  );
}