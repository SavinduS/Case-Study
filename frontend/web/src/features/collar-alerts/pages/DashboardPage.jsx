import { useCallback, useMemo, useRef, useState } from 'react';
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
 * Composes the live park map, the Active Alerts queue, the critical alert
 * modal and the operations records drawer around useCollarAlerts. The
 * module rail opens the panels this use case owns (collars, alerts,
 * geofences) and shows an explicit placeholder for everyone else's.
 */
export default function DashboardPage() {
  const alerts = useCollarAlerts();
  const mapRef = useRef(null);
  const [activeModule, setActiveModule] = useState('alerts');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleZoneIds, setVisibleZoneIds] = useState(() => alerts.zones.map((zone) => zone.zoneId));

  const {
    collars,
    zones,
    rangerTeams,
    settlements,
    openAlerts,
    alertsByPriority,
    activeAlert,
    auditTrail,
    lostCollars,
    sessionExpired,
    toast
  } = alerts;

  const delayedAlerts = useMemo(
    () => alerts.alerts.filter((alert) => alert.delayed),
    [alerts.alerts]
  );

  const activeZone = useMemo(
    () => zones.find((zone) => zone.zoneId === activeAlert?.zoneId) ?? null,
    [zones, activeAlert]
  );

  const visibleZones = useMemo(
    () => zones.filter((zone) => visibleZoneIds.includes(zone.zoneId)),
    [zones, visibleZoneIds]
  );

  const openAlertCounts = useMemo(() => {
    const counts = {};
    for (const alert of openAlerts) {
      counts[alert.zoneId] = (counts[alert.zoneId] ?? 0) + 1;
    }
    return counts;
  }, [openAlerts]);

  const toggleZone = useCallback((zoneId) => {
    setVisibleZoneIds((current) =>
      current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId]
    );
  }, []);

  const toggleAllZones = useCallback(() => {
    setVisibleZoneIds((current) => (current.length === zones.length ? [] : zones.map((z) => z.zoneId)));
  }, [zones]);

  const onSelectCollar = useCallback(
    (collarId) => {
      const match = alertsByPriority.find((alert) => alert.collarId === collarId);
      if (match) {
        alerts.selectAlert(match.alertId);
        return;
      }
      const collar = collars.find((item) => item.collarId === collarId);
      if (collar) mapRef.current?.locateCollar?.(collar.position);
    },
    [alertsByPriority, collars, alerts]
  );

  const focusCollar = useCallback(
    (collar) => {
      mapRef.current?.locateCollar?.(collar.position);
      const match = alertsByPriority.find((alert) => alert.collarId === collar.collarId);
      if (match) alerts.selectAlert(match.alertId);
    },
    [alertsByPriority, alerts]
  );

  const placeholder = activeModule ? MODULE_OWNERS[activeModule] : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-park-900">
      <DashboardMap
        ref={mapRef}
        collars={collars}
        zones={visibleZones}
        totalZoneCount={zones.length}
        rangerTeams={rangerTeams}
        settlements={settlements}
        openAlerts={openAlerts}
        onSelectCollar={onSelectCollar}
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
              alerts={alertsByPriority}
              openCount={openAlerts.length}
              selectedAlertId={activeAlert?.alertId}
              onSelect={alerts.selectAlert}
            />
          )}
          {activeModule === 'collars' && (
            <CollarRegistryPanel collars={collars} onFocusCollar={focusCollar} />
          )}
          {activeModule === 'geofences' && (
            <GeofencePanel
              zones={zones}
              openAlertCounts={openAlertCounts}
              visibleZoneIds={visibleZoneIds}
              onToggleZone={toggleZone}
              onToggleAll={toggleAllZones}
            />
          )}
        </>
      )}

      <SignalLostBanner collarIds={lostCollars} onDismiss={alerts.clearSignalLost} />

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
        onSimulateSignalLoss={() => alerts.simulateSignalLost()}
        onForceSessionExpiry={() => alerts.setSessionExpired(true)}
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

/** Small strip of controls used to demonstrate the exception flows. */
function DemoControls({ onOpenRecords, onSimulateSignalLoss, onForceSessionExpiry }) {
  return (
    <div className="absolute left-16 top-1/2 z-[700] -translate-y-1/2 rounded-md bg-white/95 p-2 shadow-lg">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">Flows</p>
      <div className="flex flex-col gap-1">
        <DemoButton label="Records" onClick={onOpenRecords} />
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