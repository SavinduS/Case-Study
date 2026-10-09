import { useCallback, useRef, useState } from 'react';
import Sidebar from '../../../layout/Sidebar.jsx';
import DashboardMap from '../components/map/DashboardMap.jsx';
import CriticalAlertModal from '../components/alerts/CriticalAlertModal.jsx';
import ActiveAlertsPanel from '../components/alerts/ActiveAlertsPanel.jsx';
import SignalLostBanner from '../components/alerts/SignalLostBanner.jsx';
import SessionExpiredOverlay from '../components/alerts/SessionExpiredOverlay.jsx';
import DispatchToast from '../components/alerts/DispatchToast.jsx';
import OperationsDrawer from '../components/alerts/OperationsDrawer.jsx';
import CollarRegistryPanel from '../components/panels/CollarRegistryPanel.jsx';
import GeofencePanel from '../components/panels/GeofencePanel.jsx';
import ModulePlaceholder from '../../../components/ui/ModulePlaceholder.jsx';
import useCollarAlerts from '../hooks/useCollarAlerts.js';

const MODULE_OWNERS = {
  incidents: {
    title: 'Field incidents',
    owner: 'Mandinu R P S (IT23610620)',
    useCaseName: 'Log Field Incident Offline (New)',
    description:
      'Rangers record snares, carcasses and illegal campsites offline and the record synchronises when connectivity returns.'
  },
  patrol: {
    title: 'Patrol planning',
    owner: 'Wijesingha S M (IT23538214)',
    useCaseName: 'Park Management and Patrol Analytics Reports',
    description:
      'Patrol route assignment, coverage statistics and drill-down into terrain zones used to allocate ranger staff.'
  },
  cameras: {
    title: 'Camera trap review',
    owner: 'Not covered by the group design',
    useCaseName: 'Referenced in the case study only',
    description:
      'The case study mentions motion-triggered camera traps, but no member owns a use case for reviewing their uploads.'
  },
  reports: {
    title: 'Analytics reports',
    owner: 'Wijesingha S M (IT23538214)',
    useCaseName: 'Park Management and Patrol Analytics Reports',
    description:
      'Statistical reporting on incidents by type and location, patrol coverage and human-wildlife conflict trends.'
  },
  settings: {
    title: 'Platform settings',
    owner: 'Shared platform module',
    useCaseName: 'Administration',
    description:
      'User accounts and park configuration are shared platform concerns rather than part of any single use case.'
  }
};

/**
 * DashboardPage — "Manage Wildlife Collar Boundary Alerts".
 *
 * The map, panels and modal read everything from useCollarAlerts, which
 * polls the API. Nothing on this page decides that a breach occurred: the
 * server detects breaches, scores them and orders the queue.
 */
export default function DashboardPage() {
  const alerts = useCollarAlerts();
  const mapRef = useRef(null);
  const [activeModule, setActiveModule] = useState('alerts');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    loading,
    error,
    park,
    collars,
    zones,
    settlements,
    rangerTeams,
    openAlerts,
    openAlertCounts,
    activeAlert,
    auditTrail,
    delayedAlerts,
    lostCollars,
    sessionExpired,
    toast,
    visibleZoneIds
  } = alerts;

  const activeZone = zones.find((zone) => zone.zoneId === activeAlert?.zoneId) ?? null;
  const placeholder = activeModule ? MODULE_OWNERS[activeModule] : null;

  /** Clicking a collar marker opens its alert, or just pans to it. */
  const selectAlertByCollar = useCallback(
    (collarId) => {
      const match = alerts.alerts.find((alert) => alert.collarId === collarId);
      if (match) {
        alerts.selectAlert(match.alertId);
        return;
      }
      const collar = collars.find((item) => item.collarId === collarId);
      if (collar) mapRef.current?.locateCollar?.(collar.lastKnownLocation.coordinates);
    },
    [alerts, collars]
  );

  /** From the collar registry: centre the map and raise the alert if there is one. */
  const locateCollar = useCallback(
    (collar) => {
      mapRef.current?.locateCollar?.(collar.lastKnownLocation.coordinates);
      const match = alerts.alerts.find((alert) => alert.collarId === collar.collarId);
      if (match) alerts.selectAlert(match.alertId);
    },
    [alerts]
  );

  if (loading) {
    return (
      <div className="grid h-full place-items-center bg-sand-100">
        <p className="text-sm font-semibold text-stone-500">Loading operations data…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-park-900">
      {error && <ApiErrorBanner message={error} onRetry={alerts.refresh} />}

      <DashboardMap
        ref={mapRef}
        park={park}
        collars={collars}
        zones={zones}
        rangerTeams={rangerTeams}
        settlements={settlements}
        openAlerts={openAlerts}
        onSelectCollar={selectAlertByCollar}
      />

      <Sidebar activeKey={activeModule} onSelect={setActiveModule} />

      {placeholder ? (
        <div className="absolute inset-0 left-14 z-[850]">
          <ModulePlaceholder {...placeholder} />
        </div>
      ) : (
        <>
          {activeModule === 'alerts' && (
            <ActiveAlertsPanel
              alerts={alerts.alerts}
              openCount={openAlerts.length}
              selectedAlertId={activeAlert?.alertId}
              onSelect={alerts.selectAlert}
            />
          )}
          {activeModule === 'collars' && (
            <CollarRegistryPanel collars={collars} onFocusCollar={locateCollar} />
          )}
          {activeModule === 'geofences' && (
            <GeofencePanel
              zones={zones}
              openAlertCounts={openAlertCounts}
              visibleZoneIds={visibleZoneIds}
              onToggleZone={(zoneId) => {
                const zone = zones.find((z) => z.zoneId === zoneId);
                alerts.setZoneEnabled(zoneId, zone?.enabled === false);
              }}
              onToggleAll={alerts.toggleAllZones}
            />
          )}
        </>
      )}

      <SignalLostBanner collarIds={lostCollars} onDismiss={alerts.dismissSignalLost} />

      <OperationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        delayedAlerts={delayedAlerts}
        auditTrail={auditTrail}
        onSelectAlert={alerts.selectAlert}
        onDispatchPatrolCheck={alerts.decideDelayedPatrolCheck}
      />

      <DispatchToast toast={toast} onDismiss={alerts.dismissToast} />

      <DemoControls
        onOpenRecords={() => setDrawerOpen((value) => !value)}
        onSimulateSignalLost={() => alerts.simulateSignalLost()}
        onForceSessionExpiry={() => alerts.setSessionExpired(true)}
        onRefresh={alerts.refresh}
      />

      <CriticalAlertModal
        alert={activeAlert}
        zone={activeZone}
        rangerTeams={rangerTeams}
        onAcknowledgeDispatch={alerts.acknowledgeAndDispatch}
        onDispatchPatrolCheck={alerts.decideDelayedPatrolCheck}
        onMonitor={alerts.monitorClosely}
        onFalseAlarm={alerts.markFalseAlarm}
        onClose={alerts.closeAlert}
      />

      <SessionExpiredOverlay open={sessionExpired} onResume={() => alerts.setSessionExpired(false)} />
    </div>
  );
}

/** Shows a backend/API failure rather than leaving a blank map. */
function ApiErrorBanner({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="absolute left-1/2 top-4 z-[1600] -translate-x-1/2 rounded-md border border-alert-600/40 bg-alert-100 px-4 py-2.5 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-bold text-alert-600">Cannot reach the API</p>
          <p className="text-xs text-stone-700">{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-stone-400 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-white/60"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

/** Small strip of controls used to demonstrate the exception flows. */
function DemoControls({ onOpenRecords, onSimulateSignalLoss, onForceSessionExpiry, onRefresh }) {
  return (
    <div className="absolute left-16 top-1/2 z-[700] -translate-y-1/2 rounded-md bg-white/95 p-2 shadow-lg">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">Flows</p>
      <div className="flex flex-col gap-1">
        <DemoButton label="Records" onClick={onOpenRecords} />
        <DemoButton label="Refresh" onClick={onRefresh} />
        <DemoButton label="Signal lost" onClick={onSimulateSignalLoss} />
        <DemoButton label="Session timeout" onClick={onForceSessionExpiry} />
      </div>
    </div>
  );
}

function DemoButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full whitespace-nowrap rounded border border-stone-300 px-2 py-1 text-left text-[11px]
        font-semibold text-stone-700 transition-colors hover:border-park-700 hover:bg-park-50"
    >
      {label}
    </button>
  );
}
