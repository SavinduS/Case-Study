import { NavLink } from 'react-router-dom';

const NAV = [
  { key: 'dashboard', label: 'Dashboard', to: '/', implemented: true },
  { key: 'dataLogs', label: 'Data Logs', to: '/data-logs', implemented: false },
  { key: 'map', label: 'Map View', to: '/map-view', implemented: false },
  { key: 'reports', label: 'Reports', to: '/reports', implemented: false },
  { key: 'admin', label: 'Admin', to: '/admin', implemented: false }
];

/**
 * Portal top bar. Matches the high-fidelity wireframe: dark park-green
 * band, two-line wordmark, tab navigation with an active pill, and the
 * signed-in Operations Officer on the right.
 */
export default function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-stretch bg-park-900 pr-4 text-white">
      <div className="flex w-56 shrink-0 items-center px-5">
        <span className="text-sm font-extrabold uppercase leading-tight tracking-wide">
          Wildlife
          <br />
          Conservation
          <br />
          Portal
        </span>
      </div>

<nav aria-label="Primary" className="flex items-stretch gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/'}
            title={
              item.implemented
                ? undefined
                : 'Owned by another use case in the group design'
            }
            className={({ isActive }) =>
              `flex items-center px-5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'bg-sand-100 text-park-900 shadow-[inset_0_-4px_0_0_#0c2b21]'
                  : item.implemented
                    ? 'text-white/75 hover:bg-white/10 hover:text-white'
                    : 'text-white/40 hover:bg-white/10 hover:text-white/80'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span className="h-8 w-px bg-white/20" aria-hidden="true" />
        <span className="grid h-9 w-9 place-items-center rounded-full bg-moss-500 text-sm font-bold">
          OO
        </span>
        <span className="text-sm font-semibold">Operations Officer</span>
        <svg className="h-4 w-4 text-white/70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
        </svg>
      </div>
    </header>
  );
}