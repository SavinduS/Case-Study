import { useEffect, useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';
import { getNearestRanger } from '../../../../services/api.js';

/**
 * Confirms the ranger dispatch before the notification is sent. The suggested
 * team comes from the server's GeofenceEngine.findNearestRanger, so the
 * browser never recomputes proximity and cannot disagree with what dispatch
 * will actually do.
 */
export default function DispatchDialog({ open, alert, rangerTeams, busy, onCancel, onConfirm }) {
  const [suggested, setSuggested] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!open || !alert) return undefined;

    let cancelled = false;
    setSelectedId(null);
    setSuggested(null);

    getNearestRanger(alert.position)
      .then((nearest) => {
        if (cancelled || !nearest) return;
        setSuggested(nearest);
        setSelectedId(nearest.rangerId);
      })
      .catch(() => {
        // Fall back to letting the officer pick manually.
      });

    return () => { cancelled = true; };
  }, [open, alert]);

  const teams = rangerTeams.filter((team) => team.status === 'available');

  return (
    <Modal open={open} onClose={onCancel} labelledBy="dispatch-title" width="max-w-lg">
      <div className="px-6 py-5">
        <h2 id="dispatch-title" className="text-base font-bold text-stone-900">
          Dispatch ranger response
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          The nearest available team is notified on its mobile unit. Delivery is retried up to three times.
        </p>

        <fieldset className="mt-4">
          <legend className="text-xs font-bold uppercase tracking-wide text-stone-500">Select team</legend>
          <div className="mt-2 space-y-2">
            {teams.map((team) => (
              <label
                key={team.rangerId}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm
                  ${selectedId === team.rangerId ? 'border-park-700 bg-park-50' : 'border-stone-200'}`}
              >
                <input
                  type="radio"
                  name="ranger-team"
                  value={team.rangerId}
                  checked={selectedId === team.rangerId}
                  onChange={() => setSelectedId(team.rangerId)}
                  className="accent-park-700"
                />
                <span className="font-semibold text-stone-800">{team.name}</span>
                {suggested?.rangerId === team.rangerId && (
                  <span className="ml-auto rounded-full bg-park-100 px-2 py-0.5 text-[10px] font-bold uppercase text-park-800">
                    Nearest
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <footer className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} disabled={busy || !selectedId}>
          {busy ? 'Dispatching…' : 'Confirm dispatch'}
        </Button>
      </footer>
    </Modal>
  );
}