export default function StepsPill({ step }) {
  const labels = ['1. Report type', '2. Criteria', '3. Results', '4. Export'];
  return (
    <div className="mb-4 flex gap-2 rounded-xl bg-white p-2 shadow-sm ring-1 ring-stone-100">
      {labels.map((l, i) => (
        <span key={l} className={`flex-1 rounded-lg px-3 py-2 text-center text-xs font-semibold ${i + 1 === step ? 'bg-park-900 text-white' : 'bg-park-100 text-park-800'}`}>{l}</span>
      ))}
    </div>
  );
}
