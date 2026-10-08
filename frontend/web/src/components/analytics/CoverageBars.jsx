import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function CoverageBars({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical">
        <XAxis type="number" domain={[0, 100]} /><YAxis type="category" dataKey="zone" width={120} /><Tooltip />
        <ReferenceLine x={75} label="Target 75%" />
        <Bar dataKey="coverage" />
      </BarChart>
    </ResponsiveContainer>
  );
}
