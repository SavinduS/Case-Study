export default function Topbar() {
  return (
    <header className="flex items-center gap-4 border-b border-stone-200 bg-white/80 px-6 py-3 backdrop-blur">
      <input placeholder="Search incidents, zones, collars" className="w-full max-w-md rounded-full bg-stone-100 px-4 py-2 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-park-700" />
      <div className="ml-auto flex items-center gap-3">
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-park-700">3 open incidents</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500 text-xs font-bold text-white">AM</span>
        <div className="text-xs leading-tight"><div className="font-bold">A. Mwangi</div><div className="text-stone-500">Park Manager</div></div>
      </div>
    </header>
  );
}
