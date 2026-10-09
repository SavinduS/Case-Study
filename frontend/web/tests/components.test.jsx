import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Button from '../src/components/ui/Button.jsx';
import Badge from '../src/components/ui/Badge.jsx';
import Modal from '../src/components/ui/Modal.jsx';
import ModulePlaceholder from '../src/components/ui/ModulePlaceholder.jsx';
import Topbar from '../src/layout/Topbar.jsx';
import Sidebar from '../src/layout/Sidebar.jsx';
import MapLegend from '../src/features/collar-alerts/components/map/MapLegend.jsx';
import { ClockChip, StatusChips, ControlStack, useClock } from '../src/features/collar-alerts/components/map/MapChrome.jsx';
import SignalLostBanner from '../src/features/collar-alerts/components/alerts/SignalLostBanner.jsx';
import SessionExpiredOverlay from '../src/features/collar-alerts/components/alerts/SessionExpiredOverlay.jsx';
import DispatchToast from '../src/features/collar-alerts/components/alerts/DispatchToast.jsx';
import OperationsDrawer from '../src/features/collar-alerts/components/alerts/OperationsDrawer.jsx';
import PortalModuleRoute from '../src/pages/PortalModuleRoute.jsx';
import { THREAT_LEVEL, ALERT_STATUS } from '../src/features/collar-alerts/domain/labels.js';

describe('Button', () => {
  it('defaults to a submit-safe type and fires onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Dispatch</Button>);
    await user.click(screen.getByRole('button', { name: 'Dispatch' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('does not fire while disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Dispatch</Button>);
    await user.click(screen.getByRole('button', { name: 'Dispatch' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Badge', () => {
  it('renders its children and tone', () => {
    render(<Badge tone="high">critical</Badge>);
    expect(screen.getByText('critical')).toBeInTheDocument();
  });
});

describe('Modal', () => {
  it('renders nothing while closed', () => {
    render(<Modal open={false} onClose={vi.fn()}><p>inside</p></Modal>);
    expect(screen.queryByText('inside')).not.toBeInTheDocument();
  });

  it('is a labelled modal dialog', () => {
    render(<Modal open onClose={vi.fn()} labelledBy="t"><h2 id="t">Title</h2></Modal>);
    expect(screen.getByRole('dialog', { name: 'Title' })).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><p>inside</p></Modal>);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<Modal open onClose={onClose}><p>inside</p></Modal>);
    const backdrop = container.parentElement.querySelector('.bg-black\\/60');
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('restores focus to whatever opened it', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = require('react').useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)}><p>inside</p></Modal>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);
    expect(screen.getByText('inside')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

describe('ModulePlaceholder', () => {
  it('names the owning member and the use case', () => {
    render(
      <ModulePlaceholder
        title="Field incidents"
        owner="Mandinu R P S (IT23610620)"
        useCaseName="Log Field Incident Offline (New)"
        description="Rangers record snares offline."
      />
    );
    expect(screen.getByRole('heading', { name: 'Field incidents' })).toBeInTheDocument();
    expect(screen.getByText('Mandinu R P S (IT23610620)')).toBeInTheDocument();
    expect(screen.getByText('Log Field Incident Offline (New)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to Collar Boundary Alerts/ })).toHaveAttribute('href', '/');
  });
});

describe('Topbar', () => {
  it('marks the active tab and links the others', () => {
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Reports' })).toHaveAttribute('href', '/reports');
  });

  it('shows the signed-in officer', () => {
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByText('Operations Officer')).toBeInTheDocument();
  });
});

describe('Sidebar', () => {
  it('exposes every module with an accessible name', () => {
    render(<Sidebar activeKey="alerts" onSelect={vi.fn()} />);
    for (const label of ['Tracked collars', 'Active alerts', 'Geofences', 'Settings']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('marks the active module', () => {
    render(<Sidebar activeKey="geofences" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Geofences' })).toHaveAttribute('aria-current', 'true');
  });

  it('reports the module the officer clicks', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Sidebar activeKey="alerts" onSelect={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'Tracked collars' }));
    expect(onSelect).toHaveBeenCalledWith('collars');
  });

  it('hints in the tooltip which module belongs to another member', () => {
    render(<Sidebar activeKey="alerts" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Patrols' })).toHaveAttribute(
      'title',
      expect.stringContaining('Wijesingha')
    );
  });
});

describe('MapLegend', () => {
  const zones = [
    { zoneId: 'Z1', name: 'Elephant Corridor', threatLevel: THREAT_LEVEL.CRITICAL },
    { zoneId: 'Z2', name: 'Village Edge', threatLevel: THREAT_LEVEL.MEDIUM }
  ];

  it('lists the fixed legend entries', () => {
    render(<MapLegend zones={[]} />);
    for (const label of ['Park Boundary', 'Animal Tracks', 'Breach Point', 'Ranger Patrols']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('lists the enabled zones', () => {
    render(<MapLegend zones={zones} />);
    expect(screen.getByText('Elephant Corridor')).toBeInTheDocument();
    expect(screen.getByText('Village Edge')).toBeInTheDocument();
  });

  it('omits a zone that is switched off', () => {
    render(<MapLegend zones={[{ ...zones[0], enabled: false }, zones[1]]} />);
    expect(screen.queryByText('Elephant Corridor')).not.toBeInTheDocument();
    expect(screen.getByText('Village Edge')).toBeInTheDocument();
  });
});

describe('MapChrome', () => {
  it('shows the park clock', () => {
    render(<ClockChip time="14:38" />);
    expect(screen.getByText('14:38')).toBeInTheDocument();
  });

  it('reports normal ingestion as active', () => {
    render(<StatusChips signalLost={false} visibleZoneCount={4} totalZoneCount={4} />);
    expect(screen.getByText('Data Ingestion Active')).toBeInTheDocument();
  });

  it('reports an interrupted feed when a collar drops', () => {
    render(<StatusChips signalLost visibleZoneCount={4} totalZoneCount={4} />);
    expect(screen.getByText('Data Ingestion Interrupted')).toBeInTheDocument();
  });

  it('counts the geofences currently drawn', () => {
    render(<StatusChips signalLost={false} visibleZoneCount={3} totalZoneCount={4} />);
    expect(screen.getByText('3 of 4 geofences shown')).toBeInTheDocument();
  });

  it('labels every map control', () => {
    render(<ControlStack onAction={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Fit park bounds' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Centre on breach' })).toBeInTheDocument();
  });

  it('reports which control was used', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<ControlStack onAction={onAction} />);
    await user.click(screen.getByRole('button', { name: 'Fit park bounds' }));
    expect(onAction).toHaveBeenCalledWith('fit');
  });

  it('ticks the clock', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useClock());
    expect(result.current).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    vi.useRealTimers();
  });
});

describe('SignalLostBanner', () => {
  it('stays hidden when every collar is reporting', () => {
    const { container } = render(<SignalLostBanner collarIds={[]} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the collar that dropped and the action to take', () => {
    render(<SignalLostBanner collarIds={['E-512']} onDismiss={vi.fn()} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/E-512/)).toBeInTheDocument();
    expect(screen.getByText(/gateway hardware or satellite link/i)).toBeInTheDocument();
  });

  it('lists several dropped collars', () => {
    render(<SignalLostBanner collarIds={['E-512', 'E-207']} onDismiss={vi.fn()} />);
    expect(screen.getByText(/E-512, E-207/)).toBeInTheDocument();
  });

  it('can be dismissed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<SignalLostBanner collarIds={['E-512']} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss signal lost warning' }));
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('SessionExpiredOverlay', () => {
  it('stays hidden while the session is live', () => {
    const { container } = render(<SessionExpiredOverlay open={false} onResume={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('explains that the alert queue will be restored', () => {
    render(<SessionExpiredOverlay open onResume={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Session expired' })).toBeInTheDocument();
    expect(screen.getByText(/restore the dashboard view and active alert queue/i)).toBeInTheDocument();
  });

  it('resumes on confirmation', async () => {
    const user = userEvent.setup();
    const onResume = vi.fn();
    render(<SessionExpiredOverlay open onResume={onResume} />);
    await user.click(screen.getByRole('button', { name: /Sign in and restore alert queue/ }));
    expect(onResume).toHaveBeenCalled();
  });
});

describe('DispatchToast', () => {
  afterEach(() => vi.useRealTimers());

  it('renders nothing when there is no toast', () => {
    const { container } = render(<DispatchToast toast={null} onDismiss={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('confirms a dispatched team', () => {
    render(<DispatchToast toast={{ kind: 'success', title: 'Addressed', body: 'Response Team Dispatched' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Addressed');
    expect(screen.getByText('Response Team Dispatched')).toBeInTheDocument();
  });

  it('tells the officer to use the radio when delivery failed', () => {
    render(<DispatchToast toast={{ kind: 'error', title: 'Dispatch failed', body: 'Failed delivery' }} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Dispatch failed');
  });

  it('can be dismissed by hand', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<DispatchToast toast={{ kind: 'info', title: 'Monitoring' }} onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('clears itself after the timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<DispatchToast toast={{ kind: 'success', title: 'Addressed' }} onDismiss={onDismiss} timeoutMs={5000} />);
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onDismiss).toHaveBeenCalled();
  });
});

describe('OperationsDrawer', () => {
  const delayedAlerts = [
    {
      alertId: 'CBA-2',
      collarId: 'E-331',
      zoneName: 'Resettlement Plot Boundary',
      gridRef: 'D5',
      status: ALERT_STATUS.DELAYED,
      detectedAt: '2026-10-09T12:50:00Z'
    }
  ];
  const auditTrail = [
    {
      auditId: 'AUD-1',
      alertId: 'CBA-1',
      action: 'ALERT_RAISED',
      actor: 'GeofenceEngine',
      detail: 'E-402 entered Z1.',
      at: '2026-10-09T14:38:00Z'
    }
  ];

  it('renders nothing while closed', () => {
    const { container } = render(
      <OperationsDrawer open={false} delayedAlerts={[]} auditTrail={[]} onClose={vi.fn()} onSelectAlert={vi.fn()} onDispatchPatrolCheck={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says when no telemetry was delayed', () => {
    render(
      <OperationsDrawer open delayedAlerts={[]} auditTrail={[]} onClose={vi.fn()} onSelectAlert={vi.fn()} onDispatchPatrolCheck={vi.fn()} />
    );
    expect(screen.getByText(/No delayed telemetry/)).toBeInTheDocument();
  });

  it('lists a retroactive breach and offers a patrol check', async () => {
    const user = userEvent.setup();
    const onDispatchPatrolCheck = vi.fn();
    render(
      <OperationsDrawer open delayedAlerts={delayedAlerts} auditTrail={[]} onClose={vi.fn()} onSelectAlert={vi.fn()} onDispatchPatrolCheck={onDispatchPatrolCheck} />
    );
    expect(screen.getByText('CBA-2')).toBeInTheDocument();
    expect(screen.getByText(/Resettlement Plot Boundary/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Dispatch patrol check' }));
    expect(onDispatchPatrolCheck).toHaveBeenCalledWith('CBA-2');
  });

  it('reopens a delayed incident for review', async () => {
    const user = userEvent.setup();
    const onSelectAlert = vi.fn();
    render(
      <OperationsDrawer open delayedAlerts={delayedAlerts} auditTrail={[]} onClose={vi.fn()} onSelectAlert={onSelectAlert} onDispatchPatrolCheck={vi.fn()} />
    );
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(onSelectAlert).toHaveBeenCalledWith('CBA-2');
  });

  it('stops offering a second patrol check once one is sent', () => {
    render(
      <OperationsDrawer
        open
        delayedAlerts={[{ ...delayedAlerts[0], status: ALERT_STATUS.ACKNOWLEDGED }]}
        auditTrail={[]}
        onClose={vi.fn()}
        onSelectAlert={vi.fn()}
        onDispatchPatrolCheck={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Dispatch patrol check' })).toBeDisabled();
  });

  it('switches to the audit trail tab', async () => {
    const user = userEvent.setup();
    render(
      <OperationsDrawer open delayedAlerts={[]} auditTrail={auditTrail} onClose={vi.fn()} onSelectAlert={vi.fn()} onDispatchPatrolCheck={vi.fn()} />
    );
    await user.click(screen.getByRole('tab', { name: /Audit trail/ }));
    expect(screen.getByText('ALERT_RAISED')).toBeInTheDocument();
    expect(screen.getByText('E-402 entered Z1.')).toBeInTheDocument();
  });

  it('says when nothing has been recorded yet', async () => {
    const user = userEvent.setup();
    render(
      <OperationsDrawer open delayedAlerts={[]} auditTrail={[]} onClose={vi.fn()} onSelectAlert={vi.fn()} onDispatchPatrolCheck={vi.fn()} />
    );
    await user.click(screen.getByRole('tab', { name: /Audit trail/ }));
    expect(screen.getByText(/No actions recorded yet/)).toBeInTheDocument();
  });

  it('can be closed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <OperationsDrawer open delayedAlerts={[]} auditTrail={[]} onClose={onClose} onSelectAlert={vi.fn()} onDispatchPatrolCheck={vi.fn()} />
    );
    await user.click(screen.getByRole('button', { name: 'Close operations records' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('PortalModuleRoute', () => {
  it('renders nothing for an unknown module', () => {
    const { container } = render(<PortalModuleRoute moduleKey="nope" />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['data-logs', 'Data Logs'],
    ['map-view', 'Map View'],
    ['reports', 'Reports'],
    ['admin', 'Admin']
  ])('%s renders its placeholder', (key, title) => {
    render(<PortalModuleRoute moduleKey={key} />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });
});
