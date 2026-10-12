import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useIsDesktop from '../features/collar-alerts/hooks/useIsDesktop.js';
import usePortalSession from './usePortalSession.js';
import { initialsOf, isEmbedded, roleLabel, signOut } from '../services/session.js';
import Sidebar, { RAIL } from './Sidebar.jsx';

// Operations Officer navigation. Three working destinations and nothing else:
// the collar alert dashboard, the villager reports workspace and the analytics
// reports workspace. Data Logs and Map View were placeholders for
// shared-platform modules, and the map the officer needs is already the
// full-bleed background of the dashboard — offering it as its own tab only sent
// people to an empty page.
const NAV = [
  { key: 'dashboard', label: 'Dashboard', to: '/', implemented: true },
  { key: 'villager-reports', label: 'Villager Reports', to: '/villager-reports', implemented: true },
  { key: 'reports', label: 'Reports', to: '/analytics/type', implemented: true }
];

/**
 * Portal top bar. Matches the high-fidelity wireframe: dark park-green
 * band, wordmark, tab navigation with an active pill, and the signed-in
 * Operations Officer on the right.
 *
 * The signed-in person comes from the session the mobile app hands over, or
 * from a sign-in in this browser (see services/session.js). Sign out clears it
 * and returns to the sign-in page — or, inside the app, sends the phone back
 * to its own login screen.
 *
 * On a phone the tab strip cannot fit, so it collapses into a hamburger that
 * opens a sheet holding the same navigation plus the module rail.
 */
export default function Topbar() {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { session } = usePortalSession();

  useEffect(() => {
    if (isDesktop) setMenuOpen(false);
  }, [isDesktop]);

  function handleSignOut() {
    // Clears the session here and tells the app, which returns to its login.
    // In a browser there is no app, so this page goes to the sign-in page.
    signOut();
    if (isEmbedded()) return;
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <header className="relative z-[1000] flex h-14 shrink-0 items-stretch bg-park-900 text-white lg:h-16 lg:pr-4">
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="grid h-14 w-14 place-items-center lg:hidden"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            {menuOpen ? (
              <path d="M5.3 5.3 10 10l4.7-4.7 1.4 1.4L11.4 11.4l4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4 4.7-4.7-4.7-4.6z" />
            ) : (
              <path d="M3 5h14v2H3V5Zm0 4h14v2H3V9Zm0 4h14v2H3v-2Z" />
            )}
          </svg>
        </button>

        <span className="whitespace-nowrap px-3 text-[11px] font-extrabold uppercase leading-tight tracking-wide lg:px-5 lg:text-sm">
          Wildlife Conservation Portal
        </span>
      </div>

      <nav aria-label="Primary" className="hidden items-stretch gap-1 lg:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            end={item.to === '/'}
            title={item.implemented ? undefined : 'Owned by another use case in the group design'}
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

      <div className="ml-auto flex items-center gap-2 pr-3 lg:gap-3 lg:pr-0">
        <span className="hidden h-8 w-px bg-white/20 lg:block" aria-hidden="true" />
        <span className="grid h-8 w-8 place-items-center rounded-full bg-moss-500 text-xs font-bold lg:h-9 lg:w-9 lg:text-sm">
          {session ? initialsOf(session.name) : 'OO'}
        </span>
        {/* The role is what this screen is about, and it is the only label
            here: the display name repeated next to it said the same thing
            twice ("Operations Officer" / "Operations Officer (Demo)"). */}
        <span className="hidden text-sm font-semibold sm:inline">{roleLabel(session)}</span>
        {/* The app's guard sends anyone without a session to the sign-in
            page, so here there is always something to sign out of. */}
        {session ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="ml-1 shrink-0 rounded-md border border-white/30 bg-white/10 px-3 py-1.5
              text-sm font-semibold text-white transition-colors hover:bg-white/20"
          >
            Sign out
          </button>
        ) : (
          <svg className="h-4 w-4 text-white/70" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M5.5 7.5 10 12l4.5-4.5H5.5Z" />
          </svg>
        )}
      </div>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="absolute inset-x-0 top-14 max-h-[calc(100vh-3.5rem)] overflow-y-auto
            border-t border-white/10 bg-park-900 pb-6 shadow-2xl lg:hidden"
        >
          <nav aria-label="Primary (compact)" className="flex flex-col">
            {NAV.map((item) => (
              <NavLink
                key={item.key}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
                title={item.implemented ? undefined : 'Owned by another use case in the group design'}
                className={({ isActive }) =>
                  `flex items-center justify-between border-b border-white/5 px-4 py-3 text-sm font-semibold ${
                    isActive
                      ? 'bg-moss-500 text-white'
                      : item.implemented
                        ? 'text-white/80'
                        : 'text-white/35'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <p className="px-4 pb-2 pt-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
            Modules
          </p>
          <ul className="px-2">
            {RAIL.map((item) => {
              const body = (
                <>
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d={item.icon} />
                  </svg>
                  {item.label}
                  {item.owner && (
                    <span className="ml-auto text-[10px] uppercase tracking-wide text-white/30">
                      {item.owner}
                    </span>
                  )}
                </>
              );
              const className = `flex items-center gap-3 rounded-lg px-2 py-2 text-sm ${
                item.owner ? 'text-white/40' : 'text-white/80'
              }`;

              return (
                <li key={item.key}>
                  {item.to ? (
                    <NavLink
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={className}
                    >
                      {body}
                    </NavLink>
                  ) : (
                    <span className={className}>{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </header>
  );
}