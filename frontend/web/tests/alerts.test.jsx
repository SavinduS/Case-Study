import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CriticalAlertModal from '../src/features/collar-alerts/components/alerts/CriticalAlertModal.jsx';
import FalseAlarmDialog from '../src/features/collar-alerts/components/alerts/FalseAlarmDialog.jsx';
import ActiveAlertsPanel from '../src/features/collar-alerts/components/alerts/ActiveAlertsPanel.jsx';
import GeofencePanel from '../src/features/collar-alerts/components/panels/GeofencePanel.jsx';
import CollarRegistryPanel from '../src/features/collar-alerts/components/panels/CollarRegistryPanel.jsx';
import { ALERT_STATUS, THREAT_LEVEL } from '../src/features/collar-alerts/domain/labels.js';

const ZONE = {
  zoneId: 'Z1',
  name: 'Elephant Corridor - Western Farmland',
  gridRef: 'G7',
  kind: 'farmland',
  threatLevel: THREAT_LEVEL.CRITICAL,
  polygon: [
    [81.03, 8.196], [81.005, 8.205], [80.972, 8.228], [80.952, 8.262],
    [80.968, 8.292], [81.008, 8.288], [81.034, 8.258], [81.038, 8.222],
    [81.03, 8.196]
  ]
};

const ALERT = {
  alertId: 'CBA-2026-0001',
  collarId: 'E-402',
  species: 'African Elephant',
  sex: 'Female',
  health: 'Stable',
  zoneId: 'Z1',
  zoneName: ZONE.name,
  gridRef: 'G7',
  threatLevel: THREAT_LEVEL.CRITICAL,
  position: [81.036, 8.241],
  depthInsideM: 12,
  distanceToSettlementM: 10579,
  detectedAt: '2026-10-09T14:38:00Z',
  status: ALERT_STATUS.ACTIVE,
  delayed: false,
  details: 'Asset E-402 crossed the designated farmland boundary into a non-protected zone.'
};

const RANGERS = [
  { rangerId: 'RT-01', name: 'Ranger Team Kandy', status: 'available', position: [81.021, 8.191] },
  { rangerId: 'RT-02', name: 'Ranger Team Matale', status: 'available', position: [81.083, 8.243] }
];

function renderModal(overrides = {}) {
  const props = {
    alert: ALERT,
    zone: ZONE,
    rangerTeams: RANGERS,
    onAcknowledgeDispatch: vi.fn(),
    onDispatchPatrolCheck: vi.fn(),
    onMonitor: vi.fn(),
    onFalseAlarm: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  return { ...render(<CriticalAlertModal {...props} />), props };
}

describe('CriticalAlertModal', () => {
  it('renders nothing when there is no alert', () => {
    const { container } = renderModal({ alert: null });
    expect(container).toBeEmptyDOMElement();
  });

  it('announces itself assertively so it interrupts a screen reader', () => {
    renderModal();
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('shows the reference id, asset and grid reference from the API', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: /CRITICAL ALERT: Boundary Breach Detected \(Asset E-402\)/i })).toBeInTheDocument();
    expect(screen.getByText('CBA-2026-0001')).toBeInTheDocument();
    expect(screen.getByText(/Elephant Corridor - Western Farmland/)).toBeInTheDocument();
    expect(screen.getByText(/Grid Ref G7/)).toBeInTheDocument();
  });

  it('shows the breach time in GMT without seconds, as the wireframe does', () => {
    renderModal();
    expect(screen.getByText('14:38 GMT')).toBeInTheDocument();
  });

  it('shows the threat level and the zone kind', () => {
    renderModal();
    expect(screen.getByText('critical')).toBeInTheDocument();
    expect(screen.getByText('Poaching Risk Zone')).toBeInTheDocument();
  });

  it('describes a delayed incident differently from a live breach', () => {
    renderModal({ alert: { ...ALERT, status: ALERT_STATUS.DELAYED, delayed: true } });
    expect(screen.getByRole('heading', { name: /Delayed Incident/i })).toBeInTheDocument();
    expect(screen.getByText(/Reconstructed from a delayed telemetry batch/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispatch Patrol Check' })).toBeInTheDocument();
  });

  it('offers the two wireframe response actions plus monitoring', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    expect(screen.getByRole('button', { name: 'Dismiss & Log' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acknowledge & Dispatch Ranger' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Monitor Closely' }));
    expect(props.onMonitor).toHaveBeenCalled();
  });

  it('asks to confirm before dispatching', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Acknowledge & Dispatch Ranger' }));
    // The dispatch dialog opens; the alert is not sent yet.
    expect(props.onAcknowledgeDispatch).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Dispatch ranger response' })).toBeInTheDocument();
  });

  it('requires notes before a false alarm can be confirmed', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Dismiss & Log' }));
    const confirm = screen.getByRole('button', { name: 'Confirm false alarm' });
    expect(confirm).toBeDisabled();

    await user.type(screen.getByLabelText(/Explanatory notes/), 'Collar signal drift.');
    expect(confirm).toBeEnabled();

    await user.click(confirm);
    expect(props.onFalseAlarm).toHaveBeenCalledWith('CBA-2026-0001', 'Collar signal drift.');
  });

  it('can be dismissed with the close control', async () => {
    const user = userEvent.setup();
    const { props } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Close alert' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});

describe('FalseAlarmDialog', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<FalseAlarmDialog open={false} alert={ALERT} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains that the alert leaves the active queue', () => {
    render(<FalseAlarmDialog open alert={ALERT} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText(/removes the alert from the active queue/i)).toBeInTheDocument();
  });

  it('cancels without recording anything', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<FalseAlarmDialog open alert={ALERT} onCancel={onCancel} onConfirm={onConfirm} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('trims whitespace-only notes so they cannot satisfy the requirement', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<FalseAlarmDialog open alert={ALERT} onCancel={vi.fn()} onConfirm={onConfirm} />);

    await user.type(screen.getByLabelText(/Explanatory notes/), '    ');
    expect(screen.getByRole('button', { name: 'Confirm false alarm' })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ActiveAlertsPanel', () => {
  const alerts = [
    { ...ALERT, alertId: 'CBA-1', priorityScore: 520 },
    {
      ...ALERT,
      alertId: 'CBA-2',
      collarId: 'E-331',
      species: 'Sri Lankan Elephant',
      zoneId: 'Z4',
      zoneName: 'Resettlement Plot Boundary',
      gridRef: 'D5',
      status: ALERT_STATUS.DELAYED,
      delayed: true
    }
  ];

  it('says so when nothing has breached', () => {
    render(<ActiveAlertsPanel alerts={[]} openCount={0} onSelect={vi.fn()} />);
    expect(screen.getByText(/No boundary alerts/)).toBeInTheDocument();
  });

  it('counts the open alerts', () => {
    render(<ActiveAlertsPanel alerts={alerts} openCount={2} onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Active Alerts' })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('labels a delayed breach for the officer', () => {
    render(<ActiveAlertsPanel alerts={alerts} openCount={2} onSelect={vi.fn()} />);
    expect(screen.getByText('Delayed incident')).toBeInTheDocument();
  });

  it('marks the top row as the priority when several are open', () => {
    render(<ActiveAlertsPanel alerts={alerts} openCount={2} onSelect={vi.fn()} />);
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('does not mark a priority when only one alert is open', () => {
    render(<ActiveAlertsPanel alerts={[alerts[0]]} openCount={1} onSelect={vi.fn()} />);
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
  });

  it('selects the alert the officer clicks', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ActiveAlertsPanel alerts={alerts} openCount={2} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /E-331/ }));
    expect(onSelect).toHaveBeenCalledWith('CBA-2');
  });

  it('shows which team took an alert', () => {
    render(
      <ActiveAlertsPanel
        alerts={[{ ...ALERT, status: ALERT_STATUS.ACKNOWLEDGED, dispatchedTo: 'Ranger Team Matale' }]}
        openCount={1}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Ranger Team Matale')).toBeInTheDocument();
  });

  it('flags a dispatch that could not be delivered', () => {
    render(
      <ActiveAlertsPanel
        alerts={[{ ...ALERT, status: ALERT_STATUS.ACKNOWLEDGED, dispatchState: 'failed' }]}
        openCount={1}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getByText('Failed delivery')).toBeInTheDocument();
  });
});

describe('GeofencePanel', () => {
  const zones = [ZONE, { ...ZONE, zoneId: 'Z4', name: 'Resettlement Plot Boundary', gridRef: 'D5', threatLevel: THREAT_LEVEL.MEDIUM, enabled: false }];

  it('lists every zone with its grid reference and threat', () => {
    render(
      <GeofencePanel
        zones={zones}
        openAlertCounts={{ Z1: 1 }}
        visibleZoneIds={['Z1']}
        onToggleZone={vi.fn()}
        onToggleAll={vi.fn()}
      />
    );
    expect(screen.getByText('Elephant Corridor - Western Farmland')).toBeInTheDocument();
    expect(screen.getByText('Resettlement Plot Boundary')).toBeInTheDocument();
    expect(screen.getByText('1 BREACH')).toBeInTheDocument();
  });

  it('reflects a zone that is hidden on the map', () => {
    render(
      <GeofencePanel
        zones={zones}
        openAlertCounts={{}}
        visibleZoneIds={['Z1']}
        onToggleZone={vi.fn()}
        onToggleAll={vi.fn()}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('toggles a single zone', async () => {
    const user = userEvent.setup();
    const onToggleZone = vi.fn();
    render(
      <GeofencePanel
        zones={zones}
        openAlertCounts={{}}
        visibleZoneIds={['Z1']}
        onToggleZone={onToggleZone}
        onToggleAll={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole('checkbox')[1]);
    expect(onToggleZone).toHaveBeenCalledWith('Z4');
  });

  it('offers Show all only when something is hidden', () => {
    const { rerender } = render(
      <GeofencePanel zones={zones} openAlertCounts={{}} visibleZoneIds={['Z1']} onToggleZone={vi.fn()} onToggleAll={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Show all' })).toBeInTheDocument();

    rerender(
      <GeofencePanel zones={zones} openAlertCounts={{}} visibleZoneIds={['Z1', 'Z4']} onToggleZone={vi.fn()} onToggleAll={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: 'Hide all' })).toBeInTheDocument();
  });
});

describe('CollarRegistryPanel', () => {
  const collar = (overrides) => ({
    collarId: 'E-402',
    gpsDeviceId: 'GPS-8841',
    species: 'African Elephant',
    sex: 'Female',
    health: 'Stable',
    speciesRisk: 'high',
    status: 'active',
    batteryLevel: 78,
    lastKnownLocation: { type: 'Point', coordinates: [81.06, 8.24] },
    ...overrides
  });

  it('lists the collars the API returned', () => {
    render(<CollarRegistryPanel collars={[collar({})]} onFocusCollar={vi.fn()} />);
    expect(screen.getByText('E-402')).toBeInTheDocument();
    expect(screen.getByText('GPS-8841')).toBeInTheDocument();
  });

  it('surfaces a signal-lost collar first', () => {
    render(
      <CollarRegistryPanel
        collars={[collar({}), collar({ collarId: 'E-512', status: 'signal_lost' })]}
        onFocusCollar={vi.fn()}
      />
    );
    const items = screen.getAllByRole('button');
    expect(within(items[0]).getByText('E-512')).toBeInTheDocument();
    expect(within(items[0]).getByText('Signal lost')).toBeInTheDocument();
  });

  it('surfaces a flat battery before a healthy collar', () => {
    render(
      <CollarRegistryPanel
        collars={[collar({}), collar({ collarId: 'E-512', batteryLevel: 12 })]}
        onFocusCollar={vi.fn()}
      />
    );
    const items = screen.getAllByRole('button');
    expect(within(items[0]).getByText('E-512')).toBeInTheDocument();
  });

  it('reports the last known coordinates', () => {
    render(<CollarRegistryPanel collars={[collar({})]} onFocusCollar={vi.fn()} />);
    expect(screen.getByText(/8\.2400 N, 81\.0600 E/)).toBeInTheDocument();
  });

  it('centres the map on the collar the officer clicks', async () => {
    const user = userEvent.setup();
    const onFocusCollar = vi.fn();
    render(<CollarRegistryPanel collars={[collar({})]} onFocusCollar={onFocusCollar} />);

    await user.click(screen.getByRole('button', { name: /E-402/ }));
    expect(onFocusCollar).toHaveBeenCalledWith(expect.objectContaining({ collarId: 'E-402' }));
  });
});
