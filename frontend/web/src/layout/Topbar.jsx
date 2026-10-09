/**
 * Only Dashboard is implemented for this use case. The remaining tabs are
 * the other modules in the Group 033 design and are owned by the other
 * three members, so they render as disabled placeholders rather than
 * links that would dead-end on a redirect.
 */
const NAV = [
  { key: 'dashboard', label: 'Dashboard', implemented: true },
  { key: 'dataLogs', label: 'Data Logs', implemented: false },
  { key: 'map', label: 'Map View', implemented: false },
  { key: 'reports', label: 'Reports', implemented: false },
  { key: 'admin', label: 'Admin', implemented: false }
];

/**
 * Portal top bar. Matches the high-fidelity wireframe: dark park-green
 * band, two-line wordmark, tab navigation with an active pill, and the
 * signed-in Operations Officer on the right.
 */
export default function Topbar({ active = 'dashboard' }) {
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
        {NAV.map((item) => {
          const isActive = item.key === active;
          return (
            <span
              key={item.key}
              aria-current={isActive ? 'page' : undefined}
              title={item.implemented ? undefined : 'Not part of this use case'}
              className={`flex items-center px-5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'cursor-default bg-sand-100 text-park-900 shadow-[inset_0_-4px_0_0_#0c2b21]'
                  : item.implemented
                    ? 'cursor-pointer text-white/75 hover:bg-white/10 hover:text-white'
                    : 'cursor-not-allowed text-white/30'
              }`}
            >
              {item.label}
            </span>
          );
        })}
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