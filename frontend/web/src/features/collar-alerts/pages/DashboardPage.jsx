import { useCallback, useMemo, useRef, useState } from 'react';
import Sidebar from '../../../layout/Sidebar.jsx';
import DashboardMap from '../components/map/DashboardMap.jsx';
import CriticalAlertModal from '../components/alerts/CriticalAlertModal.jsx';
import ActiveAlertsPanel from '../components/alerts/ActiveAlertsPanel.jsx';
import SignalLostBanner from '../components/alerts/SignalLostBanner.jsx';
import SessionExpiredOverlay from '../components/alerts/SessionExpiredOverlay.jsx';
import DispatchToast from '../components/alerts/DispatchToast.jsx';
import OperationsDrawer from '../components/alerts/OperationsDrawer.jsx';
import useCollarAlerts from '../hooks/useCollarAlerts.js';

/**
 * DashboardPage — "Manage Wildlife Collar Boundary Alerts".
 *
 * Composes the live park map, the Active Alerts queue, the critical alert
 * modal and the operations records drawer around useCollarAlerts.
 *
 * Demo controls in the top strip force the exception flows that cannot
 * otherwise be triggered on demand (gateway signal loss, session timeout,
 * failed dispatch delivery). They stand in for the backend faults.
 */
export default function DashboardPage() {
  const alerts = useCollarAlerts();
  const mapRef = useRef(null);
  const [boundaryVisible, setBoundaryVisible] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-park-900">
      <DashboardMap
        ref={mapRef}
        collars={collars}
        zones={zones}
        rangerTeams={rangerTeams}
        settlements={settlements}
        openAlerts={openAlerts}
        boundaryVisible={boundaryVisible}
        onToggleBoundary={() => setBoundaryVisible((value) => !value)}
        onSelectCollar={onSelectCollar}
      />

      <Sidebar active="alerts" />

      <ActiveAlertsPanel
        alerts={alertsByPriority}
        openCount={openAlerts.length}
        selectedAlertId={activeAlert?.alertId}
        onSelect={alerts.selectAlert}
      />

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