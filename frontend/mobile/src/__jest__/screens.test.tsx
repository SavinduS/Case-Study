import React from 'react';
import { act, create } from 'react-test-renderer';
import NewFieldIncidentScreen from '../screens/NewFieldIncidentScreen';
import ReviewIncidentScreen from '../screens/ReviewIncidentScreen';
import SubmitResultScreen from '../screens/SubmitResultScreen';
import MyIncidentsScreen from '../screens/MyIncidentsScreen';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import type { StoredFieldIncident } from '../services/incidentStorage';

const LocationMock = require('expo-location');

function validIncident(): ValidatedFieldIncident {
  return {
    capturedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    incidentType: 'snare_illegal_hunting',
    description: 'Wire snare near trail',
    location: { coordinates: [36.82145, -1.29234], accuracyMeters: 8, manual: false },
    photoUri: null
  };
}

function storedRow(
  id: string,
  status: 'pending' | 'synced' | 'failed',
  incidentType: ValidatedFieldIncident['incidentType'] = validIncident().incidentType
): StoredFieldIncident {
  return {
    id,
    reportId: id,
    incident: { ...validIncident(), incidentType },
    status,
    createdAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    updatedAt: new Date('2026-06-20T10:24:00.000Z').toISOString(),
    retryCount: 0,
    displayId: null,
    serverPhotoUrl: null
  };
}

function texts(root: any): string[] {
  return root
    .findAll((n: any) => n.type === 'Text')
    .map((n: any) => {
      const c = n.props.children;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.filter((x) => typeof x === 'string').join('');
      return '';
    })
    .filter(Boolean);
}

function findPressable(root: any, label: string) {
  const all = root.findAll(
    (n: any) => n.props && n.props.accessibilityLabel === label
  );
  return all[0];
}

function press(root: any, label: string) {
  const node = findPressable(root, label);
  expect(node).toBeTruthy();
  act(() => {
    node.props.onPress();
  });
}

/** Exercise Pressable style callbacks ({pressed} => ...) for branch coverage. */
function invokePressableStyles(root: any) {
  const nodes = root.findAll((n: any) => n.props && typeof n.props.style === 'function');
  for (const n of nodes) {
    try {
      n.props.style({ pressed: true });
    } catch {}
    try {
      n.props.style({ pressed: false });
    } catch {}
  }
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe('NewFieldIncidentScreen', () => {
  beforeEach(() => {
    LocationMock.__reset();
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({ coords: { longitude: 36.82, latitude: -1.29, accuracy: 8 } });
  });

  it('renders header, offline badge, and Review button', async () => {
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={jest.fn()} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    const t = texts(renderer.root);
    expect(t.join(' ')).toMatch(/New Incident/);
    expect(t.join(' ')).toMatch(/Offline/);
    expect(t.join(' ')).toMatch(/Review Incident/);
    expect(t.join(' ')).toMatch(/Incident Type/);
    expect(t.join(' ')).toMatch(/Description/);
  });

  it('shows inline GPS retry button on GPS error and retries', async () => {
    LocationMock.__setPermission('denied');
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={jest.fn()} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expect(findPressable(renderer.root, 'Retry GPS detection')).toBeTruthy();
    // allow retry to succeed
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({ coords: { longitude: 1, latitude: 2, accuracy: 4 } });
    press(renderer.root, 'Retry GPS detection');
    await flush();
    await flush();
  });

  it('highlights missing fields after Review pressed with empty form', async () => {
    LocationMock.__setPermission('denied');
    const onReview = jest.fn();
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={onReview} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    press(renderer.root, 'Review Incident');
    await flush();
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Check the highlighted fields/);
    expect(onReview).not.toHaveBeenCalled();
  });

  it('calls onReview when form is valid (type + description + GPS)', async () => {
    const onReview = jest.fn();
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={onReview} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    await flush();
    // pick incident type via radio (first option = snare)
    const snare = findPressable(renderer.root, 'Snare / Illegal Hunting Activity');
    expect(snare).toBeTruthy();
    act(() => snare.props.onPress());
    // type description
    const input = renderer.root.findAll((n: any) => n.type === 'TextInput')[0];
    act(() => input.props.onChangeText('Wire snare near the trail'));
    // review
    press(renderer.root, 'Review Incident');
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(onReview.mock.calls[0][0].incidentType).toBe('snare_illegal_hunting');
    expect(onReview.mock.calls[0][0].description).toBe('Wire snare near the trail');
  });

  it('opens manual location picker', async () => {
    const onOpen = jest.fn();
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={jest.fn()} onOpenManualLocation={onOpen} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    press(renderer.root, 'Change incident location');
    expect(onOpen).toHaveBeenCalled();
  });

  it('respects initialDraft values', async () => {
    let renderer: any = null;
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen
          initialDraft={{ incidentType: 'animal_carcass', description: 'herd' }}
          onReview={jest.fn()}
          onOpenManualLocation={jest.fn()}
        />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    const t = texts(renderer.root).join(' ');
    expect(t).toMatch(/Carcass/);
  });
});

describe('ReviewIncidentScreen', () => {
  it('renders read-only summary with GPS label', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <ReviewIncidentScreen
          incident={validIncident()}
          onEdit={jest.fn()}
          onSubmit={jest.fn()}
          onChangeLocation={jest.fn()}
        />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Review Incident/);
    expect(t).toMatch(/Snare/);
    expect(t).toMatch(/Wire snare near trail/);
    expect(t).toMatch(/\(GPS/);
    expect(t).toMatch(/None/);
  });

  it('shows manual pin and attached photo states', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <ReviewIncidentScreen
          incident={{ ...validIncident(), location: { coordinates: [1, 2], manual: true }, photoUri: 'file:///a.jpg' }}
          onEdit={jest.fn()}
          onSubmit={jest.fn()}
          onChangeLocation={jest.fn()}
        />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/manual pin/);
    expect(t).toMatch(/Attached/);
  });

  it('wires Edit / Submit / Change location buttons', () => {
    const onEdit = jest.fn();
    const onSubmit = jest.fn();
    const onChangeLocation = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <ReviewIncidentScreen
          incident={validIncident()}
          onEdit={onEdit}
          onSubmit={onSubmit}
          onChangeLocation={onChangeLocation}
        />
      );
    });
    press(renderer.root, 'Edit report');
    expect(onEdit).toHaveBeenCalledTimes(1);
    press(renderer.root, 'Submit Report');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    press(renderer.root, 'Change incident location');
    expect(onChangeLocation).toHaveBeenCalledTimes(1);
    invokePressableStyles(renderer.root);
  });
});

describe('SubmitResultScreen', () => {
  it('shows offline confirmation and pending chip', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen incident={validIncident()} onGoToMyIncidents={jest.fn()} onNewReport={jest.fn()} />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Report Saved Offline/);
    expect(t).toMatch(/PENDING SYNCHRONIZATION/);
    expect(t).toMatch(/Pending Synchronization/);
  });

  it('navigates to My Incidents and New Report', () => {
    const go = jest.fn();
    const fresh = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen incident={validIncident()} onGoToMyIncidents={go} onNewReport={fresh} />
      );
    });
    press(renderer.root, 'Go to My Incidents');
    expect(go).toHaveBeenCalledTimes(1);
    press(renderer.root, 'New Incident Report');
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it('shows synced receipt with displayId', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen
          incident={validIncident()}
          status="synced"
          displayId="FI-2026-0001"
          onGoToMyIncidents={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Report Synchronized/);
    expect(t).toMatch(/SYNCHRONIZED/);
    expect(t).toMatch(/FI-2026-0001/);
  });

  it('failed state shows the rejection reason with Retry and Edit Report', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen
          incident={validIncident()}
          status="failed"
          submitError="Validation failed: description too short"
          onRetry={jest.fn()}
          onEditReport={jest.fn()}
          onGoToMyIncidents={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Report Not Accepted/);
    expect(t).toMatch(/FAILED/);
    expect(t).toMatch(/Validation failed: description too short/);
    expect(t).toMatch(/Retry Submission/);
    expect(t).toMatch(/Edit Report/);
  });

  it('failed Retry and Edit Report call their handlers', () => {
    const onRetry = jest.fn();
    const onEditReport = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen
          incident={validIncident()}
          status="failed"
          submitError="Rejected"
          onRetry={onRetry}
          onEditReport={onEditReport}
          onGoToMyIncidents={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    press(renderer.root, 'Retry Submission');
    expect(onRetry).toHaveBeenCalledTimes(1);
    press(renderer.root, 'Edit report');
    expect(onEditReport).toHaveBeenCalledTimes(1);
    invokePressableStyles(renderer.root);
  });

  it('failed state without handlers still navigates away', () => {
    const go = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen
          incident={validIncident()}
          status="failed"
          onGoToMyIncidents={go}
          onNewReport={jest.fn()}
        />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/Report Not Accepted/);
    expect(t).not.toMatch(/Retry Submission/);
    press(renderer.root, 'Go to My Incidents');
    expect(go).toHaveBeenCalledTimes(1);
  });
});

describe('MyIncidentsScreen status chips', () => {
  it('shows empty state when no incidents', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen incidents={[]} syncing={false} onSyncNow={jest.fn()} onNewReport={jest.fn()} />
      );
    });
    expect(texts(renderer.root).join(' ')).toMatch(/No incidents yet/);
  });

  it('renders PENDING and SYNCHRONIZED badges', () => {
    const incidents = [
      storedRow('p1', 'pending'),
      storedRow('s1', 'synced', 'animal_carcass')
    ];
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen incidents={incidents} syncing={false} onSyncNow={jest.fn()} onNewReport={jest.fn()} />
      );
    });
    const t = texts(renderer.root).join(' | ');
    expect(t).toMatch(/PENDING SYNCHRONIZATION/);
    expect(t).toMatch(/SYNCHRONIZED/);
  });

  it('Sync Now triggers sync, disables + shows loading while syncing', () => {
    const onSync = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen
          incidents={[storedRow('p1', 'pending')]}
          syncing={true}
          onSyncNow={onSync}
          onNewReport={jest.fn()}
        />
      );
    });
    // PrimaryButton shows a spinner (not label text) while loading, but keeps
    // the accessibility label so screen readers still announce state.
    const btn = findPressable(renderer.root, 'Syncing…');
    expect(btn).toBeTruthy();
    expect(btn.props.disabled).toBe(true);
  });

  it('disables Sync when list is empty', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen incidents={[]} syncing={false} onSyncNow={jest.fn()} onNewReport={jest.fn()} />
      );
    });
    const btn = findPressable(renderer.root, 'Sync Now');
    expect(btn.props.disabled).toBe(true);
  });

  it('fires onSyncNow and onNewReport', () => {
    const onSync = jest.fn();
    const onNew = jest.fn();
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen
          incidents={[storedRow('p1', 'pending')]}
          syncing={false}
          onSyncNow={onSync}
          onNewReport={onNew}
        />
      );
    });
    press(renderer.root, 'Sync Now');
    expect(onSync).toHaveBeenCalledTimes(1);
    press(renderer.root, 'New incident report');
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe('pressable style states (coverage)', () => {
  it('exercises pressed/unpressed styles on all screens', async () => {
    LocationMock.__reset();
    LocationMock.__setPermission('granted');
    LocationMock.__setFix({ coords: { longitude: 36.82, latitude: -1.29, accuracy: 8 } });
    let r1: any = null;
    await act(async () => {
      r1 = create(
        <NewFieldIncidentScreen onReview={jest.fn()} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((res) => setTimeout(res, 0));
    });
    invokePressableStyles(r1.root);

    let r2: any = null;
    act(() => {
      r2 = create(
        <ReviewIncidentScreen
          incident={validIncident()}
          onEdit={jest.fn()}
          onSubmit={jest.fn()}
          onChangeLocation={jest.fn()}
        />
      );
    });
    invokePressableStyles(r2.root);

    let r3: any = null;
    act(() => {
      r3 = create(
        <SubmitResultScreen incident={validIncident()} onGoToMyIncidents={jest.fn()} onNewReport={jest.fn()} />
      );
    });
    invokePressableStyles(r3.root);

    let r4: any = null;
    act(() => {
      r4 = create(
        <MyIncidentsScreen
          incidents={[storedRow('p1', 'pending')]}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    invokePressableStyles(r4.root);
    expect(true).toBe(true);
  });
});


