const barColor = (v) => (v >= 75 ? 'bg-moss-500' : v >= 60 ? 'bg-gold-500' : 'bg-clay-500');

export default function CoverageBars({ data }) {
  return (
    <div className="space-y-3">
      <div className="text-right text-xs text-stone-400">Target 75%</div>
      {data.map((z) => (
        <div key={z.zone}>
          <div className="mb-1 flex justify-between text-xs"><span className="text-stone-600">{z.zone}</span><span className="font-bold">{z.coverage}%</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
            <div className={`h-full rounded-full ${barColor(z.coverage)}`} style={{ width: `${z.coverage}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
