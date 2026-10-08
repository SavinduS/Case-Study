import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, CartesianGrid, ReferenceDot } from 'recharts';

export default function TrendChart({ data }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-stone-400"><span>Weekly</span></div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="w" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
          <Area type="monotone" dataKey="count" fill="#e3efe7" stroke="none" />
          <Line type="monotone" dataKey="count" stroke="#1d4a38" strokeWidth={2} dot={{ r: 3 }} />
          <ReferenceDot x="W4" y={38} r={5} fill="#b4552d" stroke="none" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-2 flex gap-4 text-xs text-stone-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-park-700" />Incidents logged</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-clay-500" />Peak week (34 incidents, boundary breaches)</span>
      </div>
    </div>
  );
}
