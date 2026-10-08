import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StepsPill from '../../components/analytics/StepsPill.jsx';
import { Card } from '../../components/analytics/Card.jsx';
import { ZONES, CATEGORIES, validateCriteria } from '../../services/mockAnalytics.js';

export default function CriteriaPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({ from: '2023-06-01', to: '2023-06-30', zones: ZONES, categories: CATEGORIES, baseline: '' });
  const [errors, setErrors] = useState({});
  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function submit(e) {
    e.preventDefault();
    const errs = validateCriteria(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    sessionStorage.setItem('criteria', JSON.stringify(form));
    nav('/analytics/results');
  }

  return (
    <div>
      <div className="text-xs text-stone-400">Analytics / Generate report / Criteria</div>
      <h1 className="text-2xl font-extrabold">Report criteria</h1>
      <StepsPill step={2} />
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Reporting period & filters">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="mb-1 block text-xs font-bold">From</label><input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
            <div><label className="mb-1 block text-xs font-bold">To</label><input type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
          </div>
          {errors.dates && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{errors.dates}</div>}
          <div className="mt-4"><div className="mb-2 text-xs font-bold">Terrain zones</div>
            <div className="flex flex-wrap gap-2">{ZONES.map((z) => (
              <button type="button" key={z} onClick={() => setForm({ ...form, zones: toggle(form.zones, z) })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${form.zones.includes(z) ? 'bg-park-900 text-white ring-park-900' : 'bg-white text-stone-600 ring-stone-200'}`}>{z}</button>))}</div>
            {errors.zones && <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{errors.zones}</div>}</div>
          <div className="mt-4"><div className="mb-2 text-xs font-bold">Incident categories</div>
            <div className="flex flex-wrap gap-2">{CATEGORIES.map((c) => (
              <button type="button" key={c} onClick={() => setForm({ ...form, categories: toggle(form.categories, c) })}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${form.categories.includes(c) ? 'bg-park-700 text-white ring-park-700' : 'bg-white text-stone-600 ring-stone-200'}`}>{c}</button>))}</div></div>
          <div className="mt-4"><label className="mb-1 block text-xs font-bold">Baseline for compare (optional)</label>
            <input type="month" value={form.baseline} onChange={(e) => setForm({ ...form, baseline: e.target.value })} className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm" /></div>
          <div className="mt-6 flex justify-end"><button className="rounded-lg bg-park-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-park-800" type="submit">Generate Report →</button></div>
        </Card>
        <Card title="Park map">
          <div className="rounded-xl bg-park-50 p-4 text-xs text-stone-500">Zone preview uses the same polygons as the geofence service. Select zones to include in coverage, density and trend calculation.</div>
        </Card>
      </form>
    </div>
  );
}
