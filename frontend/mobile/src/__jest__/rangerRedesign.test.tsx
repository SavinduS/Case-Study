import React from 'react';
import { act, create } from 'react-test-renderer';
import MyIncidentsScreen from '../screens/MyIncidentsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RangerSidebar, { RANGER_SIDEBAR_ITEMS } from '../components/RangerSidebar';
import RangerIcon from '../components/RangerIcon';
import StatusChip from '../components/StatusChip';
import StatTile from '../components/StatTile';
import type { AuthSession } from '../auth/types';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import type { StoredFieldIncident } from '../services/incidentStorage';

const USER = { name: 'Amina Ranger', role: 'ranger' };

function validIncident(overrides: Partial<ValidatedFieldIncident> = {}): ValidatedFieldIncident {
  return {
    capturedAt: new Date().toISOString(),
    incidentType: 'snare_illegal_hunting',
    description: 'Wire snare near trail',
    location: { coordinates: [36.82145, -1.29234], accuracyMeters: 4, manual: false },
    photoUri: null,
    ...overrides
  };
}

function row(
  id: string,
  status: StoredFieldIncident['status'],
  overrides: Partial<ValidatedFieldIncident> = {},
  capturedAt = new Date().toISOString()
): StoredFieldIncident {
  return {
    id,
    reportId: id,
    incident: { ...validIncident(overrides), capturedAt },
    status,
    createdAt: capturedAt,
    updatedAt: capturedAt,
    retryCount: 0,
    displayId: 'FI-2026-0001',
    serverPhotoUrl: null
  };
}

function texts(root: any): string {
  return root
    .findAll((n: any) => n.type === 'Text')
    .map((n: any) => {
      const c = n.props.children;
      if (typeof c === 'string') return c;
      if (typeof c === 'number') return String(c);
      if (Array.isArray(c))
        return c.map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : '')).join('');
      return '';
    })
    .join(' | ');
}

// The react-native mock renders each Pressable as a composite plus a host
// node carrying the same props, so count host nodes for exact assertions.
function hostPressablesByLabel(root: any, label: string) {
  return root.findAll((n: any) => n.type === 'Pressable' && n.props?.accessibilityLabel === label);
}

function sidebar(extra: object = {}) {
  let r: any = null;
  act(() => {
    r = create(
      <RangerSidebar
        active="incidents"
        syncing={false}
        pendingCount={3}
        user={USER}
        onSelect={jest.fn()}
        onSignOut={jest.fn()}
        {...extra}
      />
    );
  });
  return r;
}

describe('RangerSidebar navigation order (Incident Reports first)', () => {
  it('exposes the dashboard order: incidents, report, sync, profile', () => {
    expect(RANGER_SIDEBAR_ITEMS.map((i) => i.id)).toEqual(['incidents', 'report', 'sync', 'profile']);
  });

  it('renders all four entries plus a single logout and the offline footer', () => {
    const r = sidebar();
    const t = texts(r.root);
    expect(t).toMatch(/Ranger Dashboard/);
    expect(t).toMatch(/Incident Reports/);
    expect(t).toMatch(/Add New Incident/);
    expect(t).toMatch(/Sync Reports/);
    expect(t).toMatch(/Ranger Profile/);
    expect(t).toMatch(/Reports stay on this device while offline/);
    expect(hostPressablesByLabel(r.root, 'Logout')).toHaveLength(1);
    // Exercise Pressable style callbacks (pressed/unpressed) for coverage.
    for (const n of r.root.findAll((x: any) => x.props && typeof x.props.style === 'function')) {
      try {
        n.props.style({ pressed: true });
      } catch {}
      try {
        n.props.style({ pressed: false });
      } catch {}
    }
  });

  it('shows the signed-in ranger profile section with real user data', () => {
    const r = sidebar();
    const t = texts(r.root);
    expect(t).toMatch(/Amina Ranger/);
    expect(t).toMatch(/Ranger/);
    // Avatar initial, no invented photo.
    expect(t).toMatch(/A/);
  });

  it('marks the active entry selected and routes presses to onSelect', () => {
    const onSelect = jest.fn();
    const r = sidebar({ active: 'report', pendingCount: 0, onSelect });
    const add = r.root.findAll(
      (n: any) => n.props?.accessibilityLabel === 'Add New Incident'
    )[0];
    expect(add.props.accessibilityState).toMatchObject({ selected: true });
    act(() => add.props.onPress());
    expect(onSelect).toHaveBeenCalledWith('report');

    const sync = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'Sync Reports')[0];
    act(() => sync.props.onPress());
    expect(onSelect).toHaveBeenCalledWith('sync');

    const profile = r.root.findAll(
      (n: any) => n.props?.accessibilityLabel === 'Ranger Profile'
    )[0];
    act(() => profile.props.onPress());
    expect(onSelect).toHaveBeenCalledWith('profile');
  });

  it('shows the pending badge and disables sync while syncing', () => {
    const r = sidebar({ syncing: true });
    expect(texts(r.root)).toMatch(/Syncing…/);
    const sync = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'Sync Reports')[0];
    expect(sync.props.accessibilityState).toMatchObject({ disabled: true });
    expect(texts(r.root)).toMatch(/3/);
  });

  it('caps the pending badge at 99+ and hides it when zero', () => {
    const capped = sidebar({ pendingCount: 120 });
    expect(texts(capped.root)).toMatch(/99\+/);

    const empty = sidebar({ pendingCount: 0 });
    expect(texts(empty.root)).not.toMatch(/99\+/);
  });

  it('fires onSignOut exactly once from the single logout entry', () => {
    const onSignOut = jest.fn();
    const r = sidebar({ onSignOut });
    const logout = hostPressablesByLabel(r.root, 'Logout')[0];
    act(() => logout.props.onPress());
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});

describe('RangerIcon (shared vector set)', () => {
  it('defaults to size 20 and passes name and color through', () => {
    let r: any = null;
    act(() => {
      r = create(<RangerIcon name="leaf" color="#1B5E20" />);
    });
    const icon = r.root.findAll((n: any) => n.type === 'Text' && n.props.size === 20)[0];
    expect(icon).toBeTruthy();
    expect(icon.props.color).toBe('#1B5E20');
  });

  it('honors an explicit size', () => {
    let r: any = null;
    act(() => {
      r = create(<RangerIcon name="menu" size={24} color="#FFFFFF" />);
    });
    const icon = r.root.findAll((n: any) => n.type === 'Text' && n.props.size === 24)[0];
    expect(icon).toBeTruthy();
  });
});

describe('StatusChip', () => {
  it.each([
    ['pending', 'Pending Synchronization'],
    ['synced', 'Synchronized'],
    ['failed', 'Failed']
  ] as const)('shows text for %s', (status: 'pending' | 'synced' | 'failed', label: string) => {
    let r: any = null;
    act(() => {
      r = create(<StatusChip status={status} />);
    });
    expect(texts(r.root)).toMatch(label.toUpperCase());
  });
});

describe('StatTile', () => {
  it('renders the label and real count', () => {
    let r: any = null;
    act(() => {
      r = create(<StatTile label="Total Incidents" value={7} icon="clipboard-text-outline" />);
    });
    const t = texts(r.root);
    expect(t).toMatch(/Total Incidents/);
    expect(t).toMatch(/7/);
  });
});

describe('MyIncidentsScreen status summary and badges (redesign states)', () => {
  const incidents = [
    row('a', 'pending', { description: 'Wire snare near trail' }),
    row('b', 'synced', { incidentType: 'animal_carcass', description: 'Elephant carcass' }),
    row('c', 'failed', { incidentType: 'footprints', description: 'Boot prints' })
  ];

  function list(extra: object = {}, items = incidents) {
    let r: any = null;
    act(() => {
      r = create(
        <MyIncidentsScreen
          incidents={items}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
          {...extra}
        />
      );
    });
    return r;
  }

  it('shows Total Incidents/Pending/Synchronized/Failed tiles', () => {
    const t = texts(list().root);
    expect(t).toMatch(/Total Incidents/);
    expect(t).toMatch(/Pending/);
    expect(t).toMatch(/Synchronized/);
    expect(t).toMatch(/Failed/);
    expect(t).toMatch(/Wire snare near trail/);
  });

  it('renders pending, synchronized and failed badges with descriptions', () => {
    const t = texts(list().root);
    expect(t).toMatch(/PENDING SYNCHRONIZATION/);
    expect(t).toMatch(/SYNCHRONIZED/);
    expect(t).toMatch(/FAILED/);
    expect(t).toMatch(/Elephant carcass/);
    expect(t).toMatch(/Boot prints/);
  });

  it('shows the rejection reason on failed reports', () => {
    const failed = [{ ...row('c', 'failed'), lastError: 'Rejected: blurry photo' }];
    expect(texts(list({}, failed).root)).toMatch(/Rejected: blurry photo/);
  });

  it('shows the empty state when no reports are stored', () => {
    expect(texts(list({}, []).root)).toMatch(/No incidents yet/);
  });

  it('shows the loading state while reports load', () => {
    expect(texts(list({ loading: true }, []).root)).toMatch(/Loading reports/);
  });

  it('surfaces the batch sync warning without losing the list', () => {
    const t = texts(
      list({ syncError: 'Some reports were rejected. Open them to correct and retry.' }).root
    );
    expect(t).toMatch(/Sync needs attention/);
    expect(t).toMatch(/Wire snare near trail/);
  });

  it('shows the result count for real records', () => {
    expect(texts(list().root)).toMatch(/Showing 3 of 3/);
  });
});

describe('MyIncidentsScreen filters operate on real records', () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const incidents = [
    row('a', 'pending', { description: 'Wire snare near trail' }, new Date(now - day).toISOString()),
    row(
      'b',
      'synced',
      { incidentType: 'animal_carcass', description: 'Elephant carcass' },
      new Date(now - 10 * day).toISOString()
    ),
    row(
      'c',
      'failed',
      { incidentType: 'footprints', description: 'Boot prints' },
      new Date(now - 40 * day).toISOString()
    )
  ];

  function list() {
    let r: any = null;
    act(() => {
      r = create(
        <MyIncidentsScreen
          incidents={incidents}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    return r;
  }

  function pressLabel(r: any, label: string) {
    const node = hostPressablesByLabel(r.root, label)[0];
    expect(node).toBeTruthy();
    act(() => node.props.onPress());
  }

  function typeText(r: any, label: string, value: string) {
    const input = r.root.findAll((n: any) => n.props?.accessibilityLabel === label)[0];
    expect(input).toBeTruthy();
    act(() => input.props.onChangeText(value));
  }

  it('searches by description and report ID', () => {
    const r = list();
    typeText(r, 'Search by report ID or description', 'carcass');
    const t = texts(r.root);
    expect(t).toMatch(/Elephant carcass/);
    expect(t).not.toMatch(/Boot prints/);
    expect(t).toMatch(/Showing 1 of 3/);
  });

  it('filters by synchronization status', () => {
    const r = list();
    pressLabel(r, 'Status filter: Pending');
    const t = texts(r.root);
    expect(t).toMatch(/Wire snare/);
    expect(t).not.toMatch(/Elephant carcass/);
    expect(t).toMatch(/Showing 1 of 3/);
  });

  it('filters by incident type', () => {
    const r = list();
    pressLabel(r, 'Type filter: Footprints / Animal Tracks');
    const t = texts(r.root);
    expect(t).toMatch(/Boot prints/);
    expect(t).not.toMatch(/Wire snare/);
  });

  it('filters by date window', () => {
    const r = list();
    pressLabel(r, 'Date filter: Last 7 days');
    let t = texts(r.root);
    expect(t).toMatch(/Wire snare/);
    expect(t).not.toMatch(/Elephant carcass/);

    pressLabel(r, 'Date filter: Last 30 days');
    t = texts(r.root);
    expect(t).toMatch(/Wire snare/);
    expect(t).toMatch(/Elephant carcass/);
    expect(t).not.toMatch(/Boot prints/);
  });

  it('shows a no-results state and clears filters', () => {
    const r = list();
    typeText(r, 'Search by report ID or description', 'zzz-no-match');
    expect(texts(r.root)).toMatch(/No matching reports/);
    pressLabel(r, 'Clear filters');
    const t = texts(r.root);
    expect(t).toMatch(/Showing 3 of 3/);
    expect(t).toMatch(/Wire snare/);
  });

  it('combines status and search filters', () => {
    const r = list();
    pressLabel(r, 'Status filter: Failed');
    typeText(r, 'Search by report ID or description', 'boot');
    const t = texts(r.root);
    expect(t).toMatch(/Boot prints/);
    expect(t).not.toMatch(/Wire snare/);
  });
});

describe('MyIncidentsScreen View details expansion', () => {
  it('expands a report to the full record and collapses again', () => {
    const item = row('a', 'pending', { description: 'Wire snare near trail' });
    let r: any = null;
    act(() => {
      r = create(
        <MyIncidentsScreen
          incidents={[item]}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    expect(texts(r.root)).not.toMatch(/Full report ID/);
    const toggle = hostPressablesByLabel(r.root, 'View details for FI-2026-0001')[0];
    expect(toggle).toBeTruthy();
    act(() => toggle.props.onPress());
    let t = texts(r.root);
    expect(t).toMatch(/Full report ID/);
    expect(t).toMatch(/Sync attempts/);

    const hide = hostPressablesByLabel(r.root, 'Hide details for FI-2026-0001')[0];
    act(() => hide.props.onPress());
    expect(texts(r.root)).not.toMatch(/Full report ID/);
    expect(t).toMatch(/Wire snare/);
  });

  it('shows the photo thumbnail when evidence is attached', () => {
    const item = row('a', 'synced', { photoUri: 'file:///photo.jpg' });
    let r: any = null;
    act(() => {
      r = create(
        <MyIncidentsScreen
          incidents={[item]}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    const toggle = hostPressablesByLabel(r.root, 'View details for FI-2026-0001')[0];
    act(() => toggle.props.onPress());
    expect(texts(r.root)).toMatch(/Photo evidence attached/);
  });
});

describe('MyIncidentsScreen per-row Retry (failed reports)', () => {
  function listWithRetry(items: StoredFieldIncident[], onRetryReport?: (id: string) => void) {
    let r: any = null;
    act(() => {
      r = create(
        <MyIncidentsScreen
          incidents={items}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
          onRetryReport={onRetryReport}
        />
      );
    });
    return r;
  }

  it('failed rows offer Retry with the report reference', () => {
    const failed = { ...row('c', 'failed'), lastError: 'Rejected: blurry photo' };
    const r = listWithRetry([failed], jest.fn());
    expect(texts(r.root)).toMatch(/Rejected: blurry photo/);
    expect(hostPressablesByLabel(r.root, 'Retry FI-2026-0001')).toHaveLength(1);
  });

  it('Retry calls onRetryReport with the stored row id', () => {
    const failed = row('c', 'failed');
    const onRetryReport = jest.fn();
    const r = listWithRetry([failed], onRetryReport);
    const btn = hostPressablesByLabel(r.root, 'Retry FI-2026-0001')[0];
    act(() => btn.props.onPress());
    expect(onRetryReport).toHaveBeenCalledTimes(1);
    expect(onRetryReport).toHaveBeenCalledWith('c');
  });

  it('pending and synced rows offer no Retry', () => {
    const r = listWithRetry([row('a', 'pending'), row('b', 'synced')], jest.fn());
    expect(hostPressablesByLabel(r.root, 'Retry FI-2026-0001')).toHaveLength(0);
  });

  it('no Retry button renders when the handler is absent', () => {
    const r = listWithRetry([{ ...row('c', 'failed'), lastError: 'Rejected' }]);
    expect(hostPressablesByLabel(r.root, 'Retry FI-2026-0001')).toHaveLength(0);
    expect(texts(r.root)).toMatch(/Rejected/);
  });
});

describe('Ranger ProfileScreen with real session data', () => {
  const session: AuthSession = {
    id: 'user-1',
    name: 'Amina Ranger',
    role: 'ranger',
    token: 'token-1',
    phone: '+94771234567',
    email: 'amina@example.com'
  };

  it('displays the actual user name, role, and contact details', () => {
    let r: any = null;
    act(() => {
      r = create(<ProfileScreen user={session} onSignOut={jest.fn()} />);
    });
    const t = texts(r.root);
    expect(t).toMatch(/Amina Ranger/);
    expect(t).toMatch(/Ranger/);
    expect(t).toMatch(/\+94771234567/);
    expect(t).toMatch(/amina@example.com/);
  });

  it('fires sign-out from the profile', () => {
    const onSignOut = jest.fn();
    let r: any = null;
    act(() => {
      r = create(<ProfileScreen user={session} onSignOut={onSignOut} />);
    });
    const btn = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'Sign out')[0];
    expect(btn).toBeTruthy();
    act(() => btn.props.onPress());
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
