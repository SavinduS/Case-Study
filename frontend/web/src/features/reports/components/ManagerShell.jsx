import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/analytics/type', label: 'Analytics' },
  { to: '/analytics/comparison', label: 'Comparison' },
  { to: '/analytics/saved', label: 'Saved reports' }
];

export default function ManagerShell({ children }) {
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
            <p className="text-xs font-bold">Park Manager</p>
            <p className="text-[10px] text-white/55">Management workspace</p>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 text-xs font-black text-park-900">PM</div>
        </div>
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}
