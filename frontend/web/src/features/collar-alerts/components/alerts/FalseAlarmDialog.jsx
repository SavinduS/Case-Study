import { useEffect, useState } from 'react';
import Modal from '../../../../components/ui/Modal.jsx';
import Button from '../../../../components/ui/Button.jsx';

/**
 * Manual override (alternate flow C). The officer must record why the alert
 * is being dismissed, because the note is stored in the audit trail and is
 * the evidence that the breach was collar signal drift.
 */
export default function FalseAlarmDialog({ open, alert, onCancel, onConfirm }) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) setNotes('');
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} labelledBy="false-alarm-title" width="max-w-lg">
      <div className="px-6 py-5">
        <h2 id="false-alarm-title" className="text-base font-bold text-stone-900">
          Mark {alert?.alertId} as false alarm
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Dismissing removes the alert from the active queue. Standard collar monitoring resumes.
        </p>

        <label htmlFor="false-alarm-notes" className="mt-4 block text-xs font-bold uppercase tracking-wide text-stone-500">
          Explanatory notes <span className="text-alert-600">*</span>
        </label>
        <textarea
          id="false-alarm-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          required
          placeholder="e.g. Stationary collar signal drift at the waterhole."
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-sm
            focus:border-park-700 focus:outline-none focus:ring-1 focus:ring-park-700"
        />
        {notes.trim().length === 0 && (
          <p className="mt-1 text-xs text-stone-500">Notes are required before the alert can be dismissed.</p>
        )}
      </div>

      <footer className="flex justify-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" disabled={notes.trim().length === 0} onClick={() => onConfirm(notes.trim())}>
          Confirm false alarm
        </Button>
      </footer>
    </Modal>
  );
}