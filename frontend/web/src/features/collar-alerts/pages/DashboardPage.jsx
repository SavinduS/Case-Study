import { useCallback, useRef, useState } from 'react';
import Sidebar, { RAIL } from '../../../layout/Sidebar.jsx';
import DashboardMap from '../components/map/DashboardMap.jsx';
import CriticalAlertModal from '../components/alerts/CriticalAlertModal.jsx';
import CriticalAlertBanner from '../components/alerts/CriticalAlertBanner.jsx';
import ActiveAlertsPanel from '../components/alerts/ActiveAlertsPanel.jsx';
import SignalLostBanner from '../components/alerts/SignalLostBanner.jsx';
import DispatchToast from '../components/alerts/DispatchToast.jsx';
import OperationsDrawer from '../components/alerts/OperationsDrawer.jsx';
import CollarRegistryPanel from '../components/panels/CollarRegistryPanel.jsx';
import GeofencePanel from '../components/panels/GeofencePanel.jsx';
import ModulePlaceholder from '../../../components/ui/ModulePlaceholder.jsx';
import useCollarAlerts from '../hooks/useCollarAlerts.js';
import useAlertAlarm from '../hooks/useAlertAlarm.js';
import { formatGmtStamp } from '../domain/labels.js';

// Modules this use case owns and therefore can actually open, mirroring the
// owned entries in the shared rail.
const OWNED_MODULES = RAIL.filter((item) => !item.owner);

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
  const alarm = useAlertAlarm({ announcedAlerts: alerts.announced });
  const mapRef = useRef(null);
  const [activeModule, setActiveModule] = useState('alerts');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    loading,
    error,
    offline,
    lastUpdatedAt,
    park,
    collars,
    zones,
    settlements,
    rangerTeams,
    openAlerts,
    openAlertCounts,
    activeAlert,
    bannerAlert,
    auditTrail,
    delayedAlerts,
    dispatchAttempts,
    lostCollars,
    toast,
    visibleZoneIds
  } = alerts;

  const activeZone = zones.find((zone) => zone.zoneId === activeAlert?.zoneId) ?? null;
  const placeholder = activeModule ? MODULE_OWNERS[activeModule] : null;

  // Named handlers rather than inline arrows, so each demo control is a
  // single, traceable call into the hook.
  const openRecords = () => setDrawerOpen((value) => !value);
  const forceSignalLoss = () => alerts.simulateSignalLost();

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
    <div className="relative h-full w-full overflow-hidden bg-park-900 pb-14 lg:pb-0">
      {error && (
        <ApiErrorBanner
          message={error}
          offline={offline}
          lastUpdatedAt={lastUpdatedAt}
          onRetry={alerts.refresh}
        />
      )}

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

      {/* The rail is hidden on narrow screens, so mirror the modules this use
          case owns as a segmented control. Without it the collar and geofence
          panels would be unreachable on a phone. */}
      <nav
        aria-label="Modules (compact)"
        className="absolute inset-x-0 top-0 z-[850] flex gap-1.5 overflow-x-auto bg-park-900/95
          px-3 py-2 backdrop-blur lg:hidden"
      >
        {OWNED_MODULES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-current={activeModule === item.key ? 'page' : undefined}
            onClick={() => setActiveModule(item.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeModule === item.key
                ? 'bg-moss-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/20'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {placeholder ? (
        <div className="absolute inset-0 z-[850] lg:left-14">
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

      {/* The persistent critical banner, independent of the modal: the officer
          can close the modal and mute the alarm, and the breach is still open. */}
      <CriticalAlertBanner
        alert={bannerAlert}
        count={openAlerts.length}
        alarm={alarm}
        onOpenAlert={alerts.selectAlert}
        onSilence={() => alerts.silenceAlert(bannerAlert.alertId)}
      />

      <SignalLostBanner collarIds={lostCollars} onDismiss={alerts.dismissSignalLost} />

      <OperationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        delayedAlerts={delayedAlerts}
        auditTrail={auditTrail}
        dispatchAttempts={dispatchAttempts}
        onSelectAlert={alerts.selectAlert}
        onDispatchPatrolCheck={alerts.decideDelayedPatrolCheck}
      />

      <DispatchToast toast={toast} onDismiss={alerts.dismissToast} />

      <DemoControls
        onOpenRecords={openRecords}
        onRefresh={alerts.refresh}
        onForceSignalLoss={forceSignalLoss}
      />

      <CriticalAlertModal
        alert={activeAlert}
        zone={activeZone}
        rangerTeams={rangerTeams}
        dispatchAttempts={dispatchAttempts}
        responding={alerts.responding[activeAlert?.alertId] ?? null}
        onLoadDispatchAttempts={alerts.loadDispatchAttempts}
        onAcknowledgeDispatch={alerts.acknowledgeAndDispatch}
        onDispatchPatrolCheck={alerts.decideDelayedPatrolCheck}
        onMonitor={alerts.monitorClosely}
        onFalseAlarm={alerts.markFalseAlarm}
        onClose={alerts.closeAlert}
      />
    </div>
  );
}

/**
 * Backend/API failure rather than a blank map. Distinguishes "the API is
 * unreachable" from "the API answered with an error", and says when the data
 * on screen was last refreshed so a stale queue is never read as current.
 */
function ApiErrorBanner({ message, offline, lastUpdatedAt, onRetry }) {
  return (
    <div
      role="alert"
      className="absolute inset-x-3 top-3 z-[1600] rounded-md border border-alert-600/40 bg-alert-100
        px-3 py-2 shadow-lg lg:left-1/2 lg:top-4 lg:-translate-x-1/2 lg:px-4 lg:py-2.5"
    >
      <div className="flex items-center gap-3">
        <div>
          <p className="text-sm font-bold text-alert-600">
            {offline ? 'Cannot reach the API' : 'The API returned an error'}
          </p>
          <p className="text-xs text-stone-700">{message}</p>
          {lastUpdatedAt && (
            <p className="text-[11px] text-stone-500">
              Showing the last successful refresh at {formatGmtStamp(lastUpdatedAt)}.
            </p>
          )}
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
function DemoControls({ onOpenRecords, onRefresh, onForceSignalLoss }) {
  return (
    <div className="absolute left-16 top-1/2 z-[700] hidden -translate-y-1/2 rounded-md bg-white/95 p-2
        shadow-lg lg:block">
      <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">Flows</p>
      <div className="flex flex-col gap-1">
        <DemoButton label="Records" onClick={onOpenRecords} />
        <DemoButton label="Refresh" onClick={onRefresh} />
        <DemoButton label="Signal lost" onClick={onForceSignalLoss} />
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