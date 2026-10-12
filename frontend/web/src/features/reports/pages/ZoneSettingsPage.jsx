import { useEffect, useState } from 'react';
import { getZoneSettings, saveZoneSettings } from '../services/reportsApi.js';
import Button from '../../../components/ui/Button.jsx';

export default function ZoneSettingsPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    getZoneSettings()
      .then((rows) => { if (active) setZones(rows); })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const update = (code, value) => setZones((rows) =>
    rows.map((z) => (z.code === code ? { ...z, requiredHours: value } : z)));

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true); setError(''); setNotice('');
    try {
      const settings = zones.map((z) => ({ code: z.code, requiredHours: Number(z.requiredHours) }));
      if (settings.some((s) => !Number.isFinite(s.requiredHours) || s.requiredHours < 0 || s.requiredHours > 10000)) {
        throw new Error('Required hours must be a number between 0 and 10000 for every zone.');
      }
      await saveZoneSettings(settings);
      setNotice('Zone settings saved. New reports will use these patrol targets.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="h-full overflow-auto bg-sand-100 p-4 sm:p-8">
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-widest text-moss-500">Park manager workspace</p>
      <h1 className="mt-1 text-2xl font-extrabold text-park-900">Zone settings</h1>
      <p className="mt-1 text-sm text-stone-500">
        Required patrol hours per zone, stored in the database. Coverage % is measured against these targets.
      </p>

      {notice && <div role="status" className="mt-4 rounded-lg border border-moss-500/30 bg-park-100 px-4 py-3 text-sm text-park-800">{notice}</div>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-alert-100 p-4 text-sm text-alert-600">{error}</p>}

      {loading ? (
        <div className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-stone-500">Loading zone settings…</div>
      ) : (
        <form onSubmit={handleSave} noValidate className="mt-5 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-stone-500">
                <tr><th className="pb-2">Zone</th><th className="pb-2">Required patrol hours</th></tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.code} className="border-t border-stone-100">
                    <td className="py-3 font-semibold text-park-900">{zone.name || zone.code}</td>
                    <td className="py-3">
                      <input
                        aria-label={`Required hours for ${zone.name || zone.code}`}
                        type="number" min="0" max="10000" step="0.5"
                        value={zone.requiredHours ?? ''}
                        onChange={(e) => update(zone.code, e.target.value)}
                        className="w-32 rounded border border-stone-300 p-2 text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <Button type="submit" size="sm" aria-busy={saving}>{saving ? 'Saving…' : 'Save zone settings'}</Button>
          </div>
          <p className="mt-3 text-xs text-stone-500">Already generated reports keep their old targets; generate a new report to apply changes.</p>
        </form>
      )}
    </div>
  </div>;
}
