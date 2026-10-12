import { NavLink, useNavigate } from 'react-router-dom';
import usePortalSession from '../../../layout/usePortalSession.js';
import { initialsOf, isEmbedded, roleLabel, signOut } from '../../../services/session.js';

const NAV = [
  { to: '/analytics/type', label: 'Analytics' },
  { to: '/analytics/comparison', label: 'Comparison' },
  { to: '/analytics/saved', label: 'Saved reports' }
];

export default function ManagerShell({ children }) {
  const navigate = useNavigate();
  const { session } = usePortalSession();

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
        <nav aria-label="Manager navigation" className="ml-8 flex h-full items-stretch gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
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
          <div className="hidden text-right sm:block">
            <p className="text-xs font-bold">{session ? roleLabel(session) : 'Park Manager'}</p>
            <p className="text-[10px] text-white/55">
              {session ? session.name : 'Management workspace'}
            </p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-xs font-black text-park-900">
            {session ? initialsOf(session.name) : 'PM'}
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