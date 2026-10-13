/**
 * Left icon rail shown behind the map in the storyboard frames.
 *
 * `owner` marks modules that belong to a different use case in the Group 033
 * design; selecting one shows an explicit placeholder instead of a dead
 * button. `collars`, `alerts` and `geofences` are driven by the collar
 * boundary alert use case and open real panels.
 *
 * Administration is deliberately absent. User accounts and park configuration
 * are an administrator's job, not part of the Operations Officer's shift, so the
 * rail does not offer a route the officer could not use. Analytics reports are
 * absent for the same reason in the other direction: they are a full workspace
 * with their own shell and top bar, not a panel that belongs on the map, so the
 * top bar's Reports tab is the only place they are offered.
 */
export const RAIL = [
  {
    key: 'collars',
    label: 'Tracked collars',
    owner: null,
    icon: 'M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5Zm0 2a3 3 0 0 1 3 3v3a3 3 0 0 1-6 0V7a3 3 0 0 1 3-3Zm0 13a5 5 0 0 0 4.6-3h-2.14a3 3 0 0 1-4.92 0H5.4A5 5 0 0 0 12 20Z'
  },
  {
    key: 'alerts',
    label: 'Active alerts',
    owner: null,
    icon: 'M12 2 1 21h22L12 2Zm0 4 7.5 13h-15L12 6Zm-1 4v4h2v-4h-2Zm0 5v2h2v-2h-2Z'
  },
  {
    key: 'geofences',
    label: 'Geofences',
    owner: null,
    icon: 'M12 2 2 7v10l10 5 10-5V7L12 2Zm0 2.3 7.5 3.8v7.8L12 19.7 4.5 15.9V8.1L12 4.3Z'
  },
  {
    key: 'incidents',
    label: 'Field incidents',
    owner: 'Mandinu R P S',
    icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.6l4 2.4-1 1.7-5-3V7h2Z'
  },
  {
    key: 'patrol',
    label: 'Patrols',
    owner: 'Wijesingha S M',
    icon: 'M4 20l4-1 10-10-3-3L5 16l-1 4Zm13.7-12.3 1.6-1.6a2 2 0 0 0 0-1.4l-2-2a2 2 0 0 0-1.4 0l-1.6 1.6 3.4 3.4Z'
  },
  {
    key: 'cameras',
    label: 'Camera traps',
    owner: 'Not in the group design',
    icon: 'M9 4h6l1.5 2H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5L9 4Zm3 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z'
  }
];

export default function Sidebar({ activeKey, onSelect }) {
  return (
    <aside
      aria-label="Modules"
      className="absolute left-0 top-0 z-[800] hidden h-full w-14 flex-col items-center gap-1
        bg-park-900/95 py-3 text-white/70 backdrop-blur lg:flex"
    >
      {RAIL.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            title={item.owner ? `${item.label} — ${item.owner}` : item.label}
            aria-label={item.label}
            aria-current={isActive ? 'true' : undefined}
            className={`grid h-10 w-10 place-items-center rounded-lg transition-colors ${
              isActive
                ? 'bg-moss-500 text-white'
                : item.owner
                  ? 'text-white/40 hover:bg-white/10 hover:text-white/80'
                  : 'hover:bg-white/10 hover:text-white'
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d={item.icon} />
            </svg>
          </button>
        );
      })}
    </aside>
  );
}