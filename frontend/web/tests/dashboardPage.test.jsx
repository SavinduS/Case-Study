import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../src/features/collar-alerts/pages/DashboardPage.jsx';
import useCollarAlerts from '../src/features/collar-alerts/hooks/useCollarAlerts.js';
import { ALERT_STATUS, THREAT_LEVEL } from '../src/features/collar-alerts/domain/labels.js';

vi.mock('../src/features/collar-alerts/hooks/useCollarAlerts.js');

// Leaflet needs a real layout engine, so the map is a stub here. Its own
// rendering is verified in a browser, and this file is about composition.
vi.mock('../src/features/collar-alerts/components/map/DashboardMap.jsx', () => ({
  default: (props) => (
    <div
      data-testid="park-map"
      data-zones={props.zones.length}
      data-collars={props.collars.length}
      data-open-alerts={props.openAlerts.length}
    />
  )
}));

const ZONE = {
  zoneId: 'Z1',
  name: 'Elephant Corridor - Western Farmland',
  gridRef: 'G7',
  kind: 'farmland',
  threatLevel: THREAT_LEVEL.CRITICAL,
  enabled: true,
  // The alert modal's mini map projects this ring.
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
  details: 'Asset E-402 crossed the designated farmland boundary.'
};

/** A hook result with only the members DashboardPage actually reads. */
function hookResult(overrides = {}) {
  return {
    loading: false,
    error: null,
    refresh: vi.fn(),
    park: { parkId: 'KNP', name: 'Minneriya', boundary: [[81, 8]], settlements: [] },
    collars: [{
      collarId: 'E-402',
      gpsDeviceId: 'GPS-8841',
      species: 'African Elephant',
      sex: 'Female',
      health: 'Stable',
      speciesRisk: 'high',
      status: 'active',
      batteryLevel: 78,
      lastKnownLocation: { coordinates: [81.06, 8.24] }
    }],
    zones: [ZONE],
    settlements: [],
    rangerTeams: [],
    alerts: [ALERT],
    openAlerts: [ALERT],
    openAlertCounts: { Z1: 1 },
    activeAlert: ALERT,
    auditTrail: [],
    delayedAlerts: [],
    lostCollars: [],
    sessionExpired: false,
    toast: null,
    visibleZoneIds: ['Z1'],
    acknowledgeAndDispatch: vi.fn(),
    monitorClosely: vi.fn(),
    markFalseAlarm: vi.fn(),
    decideDelayedPatrolCheck: vi.fn(),
    selectAlert: vi.fn(),
    closeAlert: vi.fn(),
    setZoneEnabled: vi.fn(),
    toggleAllZones: vi.fn(),
    simulateSignalLost: vi.fn(),
    dismissToast: vi.fn(),
    dismissSignalLost: vi.fn(),
    setSessionExpired: vi.fn(),
    ...overrides
  };
}

// The rail is mirrored by a compact switcher on narrow screens, so tests that
// mean "the rail" scope to the aside rather than matching a button name globally.
const railButton = (name) =>
  within(screen.getByRole('complementary', { name: 'Modules' })).getByRole('button', { name });

const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);

beforeEach(() => {
  vi.mocked(useCollarAlerts).mockReturnValue(hookResult());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('waits for the API before drawing the map', () => {
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ loading: true }));
    renderPage();
    expect(screen.getByText(/Loading operations data/)).toBeInTheDocument();
  });

  it('shows the active alert queue by default', () => {
    renderPage();
    expect(screen.getByRole('region', { name: 'Active alerts queue' })).toBeInTheDocument();
  });

  it('opens the critical alert modal for the breach the server detected', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Boundary Breach Detected \(Asset E-402\)/ })).toBeInTheDocument();
  });

  it('renders nothing for the modal when no alert is active', () => {
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ activeAlert: null }));
    renderPage();
    expect(screen.queryByRole('heading', { name: /Boundary Breach Detected/ })).not.toBeInTheDocument();
  });

  it('surfaces an API failure with a retry instead of a blank map', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ error: 'Cannot reach the API. Is the backend running?', refresh }));
    renderPage();

    expect(screen.getByText('Cannot reach the API')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('opens the collar registry from the module rail', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(railButton('Tracked collars'));
    expect(screen.getByRole('region', { name: 'Tracked collars' })).toBeInTheDocument();
  });

  it('opens the geofence register from the module rail', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(railButton('Geofences'));
    expect(screen.getByRole('region', { name: 'Geofences' })).toBeInTheDocument();
  });

  it('hides the queue when another module is open', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(railButton('Tracked collars'));
    expect(screen.queryByRole('region', { name: 'Active alerts queue' })).not.toBeInTheDocument();
  });

  it('offers the owned modules in the compact switcher used on phones', async () => {
    const user = userEvent.setup();
    renderPage();
    const switcher = screen.getByRole('navigation', { name: 'Modules (compact)' });
    const names = within(switcher)
      .getAllByRole('button')
      .map((b) => b.textContent.trim());
    // Only the modules this use case owns; other members' modules stay in the rail.
    expect(names).toEqual(['Tracked collars', 'Active alerts', 'Geofences']);
  });

  it('switches module from the compact switcher', async () => {
    const user = userEvent.setup();
    renderPage();
    const switcher = screen.getByRole('navigation', { name: 'Modules (compact)' });
    await user.click(within(switcher).getByRole('button', { name: 'Geofences' }));
    expect(screen.getByRole('region', { name: 'Geofences' })).toBeInTheDocument();
    expect(within(switcher).getByRole('button', { name: 'Geofences' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('shows another member’s module as a placeholder, not a dead panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(railButton('Field incidents'));
    expect(screen.getByRole('heading', { name: 'Field incidents' })).toBeInTheDocument();
    expect(screen.getByText(/Mandinu R P S/)).toBeInTheDocument();
  });

  it('toggles a zone through the hook so the server is told', async () => {
    const user = userEvent.setup();
    const setZoneEnabled = vi.fn();
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ setZoneEnabled, activeAlert: null }));
    renderPage();

    await user.click(railButton('Geofences'));
    await user.click(screen.getAllByRole('checkbox')[0]);
    // The zone is currently enabled, so the officer is turning it off.
    expect(setZoneEnabled).toHaveBeenCalledWith('Z1', false);
  });

  it('shows the Signal Lost banner only when a collar is down', async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    expect(screen.queryByText('Signal Lost')).not.toBeInTheDocument();
    unmount();

    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ lostCollars: ['E-512'] }));
    renderPage();
    expect(screen.getByText('Signal Lost')).toBeInTheDocument();
  });

  it('reports a simulated signal loss through the hook', async () => {
    const user = userEvent.setup();
    const simulateSignalLost = vi.fn();
    // No active alert: the modal overlay would otherwise cover the demo strip.
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ simulateSignalLost, activeAlert: null }));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Signal lost' }));
    expect(simulateSignalLost).toHaveBeenCalled();
  });

  it('shows the session expired overlay when the hook says so', () => {
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ sessionExpired: true }));
    renderPage();
    expect(screen.getByRole('heading', { name: 'Session expired' })).toBeInTheDocument();
  });

  it('toggles the operations records drawer from the demo strip', async () => {
    const user = userEvent.setup();
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ activeAlert: null }));
    renderPage();
    expect(screen.queryByRole('region', { name: 'Operations records' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Records' }));
    expect(screen.getByRole('region', { name: 'Operations records' })).toBeInTheDocument();
  });

  it('refreshes on demand from the demo strip', async () => {
    const user = userEvent.setup();
    const refresh = vi.fn();
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ refresh, activeAlert: null }));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('forwards the officer actions from the modal to the hook', async () => {
    const user = userEvent.setup();
    const markFalseAlarm = vi.fn();
    vi.mocked(useCollarAlerts).mockReturnValue(hookResult({ markFalseAlarm }));
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Dismiss & Log' }));
    await user.type(screen.getByLabelText(/Explanatory notes/), 'Signal drift.');
    await user.click(screen.getByRole('button', { name: 'Confirm false alarm' }));

    await waitFor(() => expect(markFalseAlarm).toHaveBeenCalledWith('CBA-2026-0001', 'Signal drift.'));
  });

  it('shows the dispatch toast the hook produced', () => {
    vi.mocked(useCollarAlerts).mockReturnValue(
      hookResult({ activeAlert: null, toast: { kind: 'success', title: 'Addressed', body: 'Response Team Dispatched' } })
    );
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Response Team Dispatched');
  });
});
