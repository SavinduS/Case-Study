import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';

function userId(user) {
  return user?.id ?? user?._id ?? '';
}

function userLabel(user) {
  return user?.name ?? user?.phone ?? userId(user);
}

function assigneeLabel(incident) {
  if (typeof incident.assignee === 'string') return incident.assignee;
  if (incident.assigneeId) return incident.assigneeId;
  return incident.assignee?.name ?? 'Unassigned';
}

/**
 * IncidentDetailPanel — side panel with the full incident and the actions
 * valid for its current status:
 * - submitted -> Mark as Triaged
 * - triaged   -> Assign (responder dropdown), Escalate, Reject
 * Escalate and Reject ask for confirmation; Reject needs a reason.
 * Every button is disabled while a request is running.
 */
export default function IncidentDetailPanel({
  incident,
  responders,
  actionBusy,
  actionError,
  actionNotice,
  onAction,
  onClose
}) {
  const [assigneeId, setAssigneeId] = useState('');
  const [confirm, setConfirm] = useState(null); // 'escalate' | 'reject' | null
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);

  if (!incident) return null;

  const status = incident.status ?? 'submitted';
  const canTriage = status === 'submitted';
  const canDecide = status === 'triaged';

  const openReject = () => {
    setReason('');
    setReasonError(null);
    setConfirm('reject');
  };

  const confirmAction = async () => {
    if (confirm === 'reject' && !reason.trim()) {
      setReasonError('A reason is required to reject an incident.');
      return;
    }
    const kind = confirm;
    setConfirm(null);
    await onAction(kind, kind === 'reject' ? { reason: reason.trim() } : undefined);
  };

  return (
    <aside
      aria-label="Incident details"
      className="flex w-full max-w-md shrink-0 flex-col border-l border-stone-200 bg-white"
    >
      <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-3">
        <h2 className="text-base font-bold text-park-900">Incident details</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="ml-auto rounded p-1 text-stone-500 hover:bg-stone-100"
        >
          ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {actionError && (
          <div role="alert" className="mb-3 rounded-md border border-alert-600/30 bg-alert-100 px-3 py-2 text-sm text-alert-600">
            {actionError}
          </div>
        )}
        {actionNotice && (
          <div role="status" className="mb-3 rounded-md border border-gold-500/40 bg-gold-100 px-3 py-2 text-sm text-gold-500">
            {actionNotice}
          </div>
        )}

        <dl className="space-y-3 text-sm">
          <Detail label="Type" value={incident.type ?? '—'} />
          <Detail label="Severity" value={incident.severity ?? '—'} />
          <Detail
            label="Location"
            value={incident.locationText ?? coordsLabel(incident)}
          />
          <Detail label="Reporter" value={reporterValue(incident)} />
          <Detail label="Submitted" value={dateValue(incident.submittedAt ?? incident.createdAt)} />
          <Detail
            label="Status"
            value={<Badge tone="neutral" size="sm">{status}</Badge>}
          />
          <Detail
            label="Source"
            value={incident.source === 'offline_sync' ? 'Offline sync' : (incident.source ?? '—')}
          />
          <Detail label="Assignee" value={assigneeLabel(incident)} />
        </dl>

        {incident.description && (
          <div className="mt-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Description</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-stone-800">{incident.description}</p>
          </div>
        )}

        <div className="mt-6 border-t border-stone-200 pt-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-stone-500">Actions</h3>

          {canTriage && (
            <div className="mt-3">
              <Button variant="dark" onClick={() => onAction('triage')} disabled={actionBusy}>
                {actionBusy ? 'Working…' : 'Mark as Triaged'}
              </Button>
            </div>
          )}

          {canDecide && (
            <div className="mt-3 space-y-3">
              <div className="flex gap-2">
                <select
                  aria-label="Assign to responder"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={actionBusy}
                  className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800 disabled:opacity-50"
                >
                  <option value="">Select responder…</option>
                  {responders.map((user) => (
                    <option key={userId(user)} value={userId(user)}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  disabled={actionBusy || !assigneeId}
                  onClick={() => onAction('assign', { assigneeId })}
                >
                  Assign
                </Button>
              </div>
              {responders.length === 0 && (
                <p className="text-xs text-stone-500">No responders available.</p>
              )}

              <div className="flex gap-2">
                <Button variant="outline" disabled={actionBusy} onClick={() => setConfirm('escalate')}>
                  Escalate
                </Button>
                <Button variant="primary" disabled={actionBusy} onClick={openReject}>
                  Reject
                </Button>
              </div>
            </div>
          )}

          {!canTriage && !canDecide && (
            <p role="status" className="mt-3 text-sm text-stone-500">
              No further actions are available while this incident is “{status}”.
            </p>
          )}
        </div>
      </div>

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        labelledBy="triage-confirm-title"
        width="max-w-md"
      >
        <div className="px-6 py-5">
          <h2 id="triage-confirm-title" className="text-lg font-bold text-park-900">
            {confirm === 'escalate' ? 'Escalate incident?' : 'Reject incident?'}
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {confirm === 'escalate'
              ? 'The incident will be flagged for urgent attention. This cannot be undone from here.'
              : 'The incident will be closed as rejected. A reason is required.'}
          </p>
          {confirm === 'reject' && (
            <div className="mt-3">
              <label htmlFor="triage-reject-reason" className="text-xs font-bold uppercase tracking-wide text-stone-500">
                Reason (required)
              </label>
              <textarea
                id="triage-reject-reason"
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError(null);
                }}
                className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm text-stone-800"
              />
              {reasonError && (
                <p role="alert" className="mt-1 text-xs font-semibold text-alert-600">{reasonError}</p>
              )}
            </div>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)} disabled={actionBusy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={confirmAction} disabled={actionBusy}>
              {actionBusy ? 'Working…' : confirm === 'escalate' ? 'Confirm escalation' : 'Confirm rejection'}
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-stone-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-stone-800">{value}</dd>
    </div>
  );
}

function coordsLabel(incident) {
  const coords = incident.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) return `${coords[0]}, ${coords[1]}`;
  return '—';
}

function reporterValue(incident) {
  if (typeof incident.reporter === 'string') return incident.reporter;
  return incident.reporterName ?? incident.reporter?.name ?? '—';
}

function dateValue(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
