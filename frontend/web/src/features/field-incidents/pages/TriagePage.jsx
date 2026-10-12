import IncidentDetailPanel from '../components/IncidentDetailPanel.jsx';
import TriageTable from '../components/TriageTable.jsx';
import useTriageIncidents from '../hooks/useTriageIncidents.js';

// No auth context exists in the web app yet; the backend signs `{ role }`
// into the JWT (roles: villager, ranger, officer, manager) and guards its
// supervisor feed with requireRole('officer', 'manager'). Until the login
// module owns role state, this page accepts the task's supervisor/admin
// roles plus their backend equivalents, read from localStorage.
const ALLOWED_ROLES = ['supervisor', 'admin', 'officer', 'manager'];

function readStoredRole() {
  try {
    const direct = localStorage.getItem('wildlife-portal:role');
    if (direct) return direct;
    const token = localStorage.getItem('wildlife-portal:token');
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
      if (payload?.role) return payload.role;
    }
  } catch {
    // Corrupt storage must never blank-screen the portal.
  }
  return null;
}

/**
 * TriagePage — supervisor triage at /incidents/triage. Wires the single
 * useTriageIncidents hook to TriageTable + IncidentDetailPanel. Non
 * supervisor/admin roles get an access-denied card instead of the queue.
 */
export default function TriagePage() {
  const role = readStoredRole();
  if (role && !ALLOWED_ROLES.includes(role)) {
    return (
      <div className="grid h-full place-items-center bg-sand-100 p-8">
        <div
          role="alert"
          className="w-full max-w-lg rounded-lg bg-white p-8 shadow-sm ring-1 ring-stone-200"
        >
          <h2 className="text-2xl font-bold text-park-900">Access denied</h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Incident triage is limited to supervisor and admin roles.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-md bg-park-800 px-4 py-2 text-sm font-semibold text-white hover:bg-park-700"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  return <TriageView />;
}

function TriageView() {
  const triage = useTriageIncidents();

  return (
    <div className="flex h-full min-h-0 flex-col bg-sand-100 md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="shrink-0 px-5 pt-4">
          <h1 className="text-xl font-bold text-park-900">Field incident triage</h1>
          <p className="text-sm text-stone-500">
            Review submitted reports, then triage, assign, escalate or reject them.
          </p>
        </header>
        <TriageTable
          incidents={triage.incidents}
          total={triage.total}
          loading={triage.loading}
          error={triage.error}
          onRetry={triage.refresh}
          filters={triage.filters}
          onFilterChange={triage.setFilter}
          onResetFilters={triage.resetFilters}
          page={triage.page}
          totalPages={triage.totalPages}
          onPrev={triage.prevPage}
          onNext={triage.nextPage}
          selectedId={triage.selectedId}
          onSelect={triage.select}
        />
      </div>
      {triage.selected && (
        <IncidentDetailPanel
          incident={triage.selected}
          responders={triage.responders}
          actionBusy={triage.actionBusy}
          actionError={triage.actionError}
          actionNotice={triage.actionNotice}
          onAction={triage.runAction}
          onClose={triage.closeDetail}
        />
      )}
    </div>
  );
}
