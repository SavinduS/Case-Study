import { NavLink } from 'react-router-dom';

const link = ({ isActive }) =>
  `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-park-700 text-white' : 'text-emerald-100/80 hover:bg-park-800 hover:text-white'}`;

export default function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col gap-5 bg-park-900 p-5 text-emerald-50">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-moss-500 text-lg">🌿</span>
        <div><div className="text-sm font-bold">Serengeti Portal</div><div className="text-[11px] text-emerald-100/60">Conservation operations</div></div>
      </div>
      <div>
        <div className="mb-1 px-3 text-[11px] tracking-wider text-emerald-100/50">OPERATIONS</div>
        <nav className="space-y-1">
          <span className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-emerald-100/40">● Active incidents</span>
          <span className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-emerald-100/40">● Patrol log</span>
          <span className="block cursor-not-allowed rounded-lg px-3 py-2 text-sm text-emerald-100/40">● Collar telemetry</span>
        </nav>
      </div>
      <div>
        <div className="mb-1 px-3 text-[11px] tracking-wider text-emerald-100/50">ANALYTICS</div>
        <nav className="space-y-1">
          <NavLink to="/analytics/type" className={link}>● Generate report</NavLink>
          <NavLink to="/analytics/saved" className={link}>● Saved reports</NavLink>
          <NavLink to="/analytics/criteria" className={link}>● Zone settings</NavLink>
        </nav>
      </div>
      <div className="mt-auto rounded-xl bg-park-700 p-3 text-xs">
        <div className="font-bold text-emerald-100">Data sync healthy</div>
        <div className="text-emerald-100/70">Incident and patrol logs last synced 15 Jun 2023, 10:00.</div>
      </div>
    </aside>
  );
}
