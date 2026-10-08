export default function StepsPill({ step }) {
  const labels = ['1. Report type', '2. Criteria', '3. Results', '4. Export'];
  return <div className="steps">{labels.map((l, i) => <span key={l} className={i + 1 === step ? 'on' : ''}>{l}</span>)}</div>;
}
