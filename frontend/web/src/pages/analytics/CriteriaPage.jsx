import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepsPill from '../../components/analytics/StepsPill.jsx';
import { ZONES, CATEGORIES, validateCriteria } from '../../services/mockAnalytics.js';

export default function CriteriaPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({ from: '2023-06-01', to: '2023-06-30', zones: ZONES, categories: CATEGORIES, baseline: '' });
  const [errors, setErrors] = useState({});

  function toggle(list, v) { return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]; }

  function submit(e) {
    e.preventDefault();
    const errs = validateCriteria(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return; // doc exception: invalid criteria highlighted
    sessionStorage.setItem('criteria', JSON.stringify(form));
    nav('/analytics/results');
  }

  return (
    <div>
      <h2>Analytics / Generate report / Criteria</h2>
      <StepsPill step={2} />
      <form className="card" onSubmit={submit}>
        <label>Reporting period (from)</label>
        <input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
        <label>Reporting period (to)</label>
        <input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        {errors.dates && <div className="err">{errors.dates}</div>}
        <label>Terrain zones</label>
        <div className="checkrow">{ZONES.map((z) => (
          <label key={z}><input type="checkbox" checked={form.zones.includes(z)} onChange={() => setForm({ ...form, zones: toggle(form.zones, z) })} /> {z}</label>
        ))}</div>
        {errors.zones && <div className="err">{errors.zones}</div>}
        <label>Incident categories</label>
        <div className="checkrow">{CATEGORIES.map((c) => (
          <label key={c}><input type="checkbox" checked={form.categories.includes(c)} onChange={() => setForm({ ...form, categories: toggle(form.categories, c) })} /> {c}</label>
        ))}</div>
        <label>Baseline period for compare (optional)</label>
        <input type="month" value={form.baseline} onChange={(e) => setForm({ ...form, baseline: e.target.value })} />
        <div className="btnrow"><button className="btn primary" type="submit">Generate Report</button></div>
      </form>
    </div>
  );
}
