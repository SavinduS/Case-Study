import { NavLink } from 'react-router-dom';

/**
 * Left icon rail shown behind the map in the storyboard frames.
 *
 * `owner` marks modules that belong to a different use case in the Group 033
 * design; selecting one shows an explicit placeholder instead of a dead
 * button. `collars`, `alerts` and `geofences` are driven by the collar
 * boundary alert use case and open real panels.
 *
 * `reports` carries a `to` instead of being a panel: the analytics reports are
 * a full workspace with their own shell, so the rail links straight into it
 * rather than opening an overlay on the map. Everything without `to` is
 * reported through `onSelect` as a panel key.
 *
 * Villager reports are deliberately absent from the rail. They are a
 * full-screen workspace of their own, reached from the top bar, so putting
 * them here would offer a map overlay that the officer has to leave to use.
 *
 * Administration is deliberately absent. User accounts and park configuration
 * are an administrator's job, not part of the Operations Officer's shift, so the
 * rail does not offer a route the officer could not use.
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
    key: 'reports',
    label: 'Reports',
    owner: null,
    to: '/analytics/type',
    icon: 'M4 20h3V10H4v10Zm6.5 0h3V4h-3v16ZM17 20h3v-7h-3v7Z'
  }
];

/**
 * Icon rail. Entries that open a panel on the map report their key through
 * `onSelect`; entries with a `to` are real links and leave the dashboard for
 * the workspace they belong to.
 */
export default function Sidebar({ activeKey, onSelect }) {
  return (
    <aside
      aria-label="Modules"
      className="absolute left-0 top-0 z-[800] hidden h-full w-14 flex-col items-center gap-1
        bg-park-900/95 py-3 text-white/70 backdrop-blur lg:flex"
    >
      {RAIL.map((item) => {
        const isActive = item.key === activeKey;
        const className = `grid h-10 w-10 place-items-center rounded-lg transition-colors ${
          isActive
            ? 'bg-moss-500 text-white'
            : item.owner
              ? 'text-white/40 hover:bg-white/10 hover:text-white/80'
              : 'hover:bg-white/10 hover:text-white'
        }`;
        const icon = (
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={item.icon} />
          </svg>
        );

        if (item.to) {
          return (
            <NavLink
              key={item.key}
              to={item.to}
              title={item.label}
              aria-label={item.label}
              className={className}
            >
              {icon}
            </NavLink>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            title={item.owner ? `${item.label} — ${item.owner}` : item.label}
            aria-label={item.label}
            aria-current={isActive ? 'true' : undefined}
            className={className}
          >
            {icon}
          </button>
        );
      })}
    </aside>
  );
}