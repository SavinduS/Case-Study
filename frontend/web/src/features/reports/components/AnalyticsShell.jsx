import { NavLink, useNavigate } from 'react-router-dom';
import usePortalSession from '../../../layout/usePortalSession.js';
import { initialsOf, isEmbedded, roleLabel, signOut } from '../../../services/session.js';

const NAV = [
  { to: '/analytics/type', label: 'Analytics' },
  { to: '/analytics/comparison', label: 'Comparison' },
  { to: '/analytics/saved', label: 'Saved reports' }
];

/**
 * Shell for the analytics workspace. Both the Park Manager and the Operations
 * Officer use it: the officer needs the same incident, patrol and conflict
 * figures to judge how urgent a dispatch is, and the backend scopes each
 * report to the caller so one role never reads the other's saved reports.
 *
 * The officer arrives here from the top bar, so this shell carries its own
 * route back to the alert dashboard — without it the officer was trapped in
 * this workspace with no visible way out. The Park Manager's home *is* this
 * workspace, so the link is only offered to the officer.
 */
export default function AnalyticsShell({ children }) {
  const navigate = useNavigate();
  const { session } = usePortalSession();
  const isOfficer = session?.role === 'officer';

  function handleSignOut() {
    signOut();
    // Inside the app the host decides what the phone shows next.
    if (isEmbedded()) return;
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen flex-col bg-sand-100">
      <header className="flex min-h-[4.5rem] shrink-0 items-center bg-park-900 px-4 text-white shadow-lg sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-moss-500 text-lg font-black">W</div>
          <div>
            <p className="text-sm font-extrabold uppercase leading-tight tracking-[0.18em]">Wildlife</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/60">Conservation portal</p>
          </div>
        </div>
        <nav aria-label="Analytics navigation" className="ml-8 flex h-full items-stretch gap-1">
          {isOfficer && (
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-2 border-b-4 px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-moss-500 bg-white/10 text-white'
                    : 'border-transparent text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z" />
              </svg>
              Back to dashboard
            </NavLink>
          )}
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center border-b-4 px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-moss-500 bg-white/10 text-white'
                    : 'border-transparent text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 border-l border-white/15 pl-4">
          {/* Role only, matching the officer top bar: the display name sat
              beside it saying the same thing twice. */}
          <span className="hidden text-sm font-semibold sm:inline">
            {session ? roleLabel(session) : 'Operations Officer'}
          </span>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-xs font-black text-park-900">
            {session ? initialsOf(session.name) : 'OO'}
          </div>
          {/* Same escape hatch as the officer top bar: this shell does not
              render the Topbar, so it needs its own. */}
          {session ? (
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm
                font-semibold text-white transition-colors hover:bg-white/20"
            >
              Sign out
            </button>
          ) : null}
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}