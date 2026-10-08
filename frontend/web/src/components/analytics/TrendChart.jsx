import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}><XAxis dataKey="w" /><YAxis /><Tooltip /><Line dataKey="count" dot={false} /></LineChart>
    </ResponsiveContainer>
  );
}
