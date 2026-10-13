import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import LocationCard from '../components/LocationCard';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';
import MyIncidentsScreen from '../screens/MyIncidentsScreen';
import NewFieldIncidentScreen from '../screens/NewFieldIncidentScreen';
import ReviewIncidentScreen from '../screens/ReviewIncidentScreen';
import SubmitResultScreen from '../screens/SubmitResultScreen';
import { useFieldIncidentForm } from '../hooks/useFieldIncidentForm';
import { colors, contrastRatio, MIN_TOUCH_TARGET } from '../theme';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import type { StoredFieldIncident } from '../services/incidentStorage';

const FS = require('expo-file-system');
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

function storedRow(id: string, status: StoredFieldIncident['status']): StoredFieldIncident {
  return {
    id,
    reportId: id,
    incident: validIncident(),
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    retryCount: 0,
    displayId: 'FI-2026-0001',
    serverPhotoUrl: null
  };
}

function texts(renderer: any): string {
  return renderer.root
    .findAll((n: any) => n.type === 'Text')
    .map((n: any) => {
      const c = n.props.children;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.filter((x) => typeof x === 'string').join('');
      return '';
    })
    .join(' | ');
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  FS.__reset();
  LocationMock.__reset();
  LocationMock.__setPermission('granted');
  LocationMock.__setFix({ coords: { longitude: 36.82, latitude: -1.29, accuracy: 8 } });
});

describe('photo limit hint (FIX 5)', () => {
  it('renders "1 photo, max 5MB, JPEG/PNG" on the picker', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <PhotoPicker photoUri={null} photoError={null} onChange={jest.fn()} />
      );
    });
    expect(texts(renderer)).toMatch(/1 photo, max 5MB, JPEG\/PNG/);
  });
});

describe('inline async photo validation on the New Incident form (FIX 5)', () => {
  function renderForm() {
    let current: any = null;
    function Probe() {
      current = useFieldIncidentForm({});
      return null;
    }
    let root: any = null;
    act(() => {
      root = create(<Probe />);
    });
    return { get: () => current, unmount: () => act(() => root.unmount()) };
  }

  const location = { coordinates: [36.82145, -1.29234], accuracyMeters: 8, manual: false } as const;

  function fillValid(h: { get: () => any }) {
    act(() => {
      h.get().setIncidentType('snare_illegal_hunting');
      h.get().setDescription('Wire snare near trail');
    });
  }

  it('flags an oversized photo inline before Review', async () => {
    FS.__setFileSize('file:///big.jpg', 6 * 1024 * 1024);
    const h = renderForm();
    act(() => {
      h.get().handlePhotoChange('file:///big.jpg');
    });
    await flush();
    expect(h.get().photoError).toMatch(/5 MB/);
    h.unmount();
  });

  it('flags an unsupported photo type inline before Review', async () => {
    const h = renderForm();
    act(() => {
      h.get().handlePhotoChange('file:///notes.pdf');
    });
    await flush();
    expect(h.get().photoError).toMatch(/JPEG or PNG/);
    h.unmount();
  });

  it('allows a photo whose size cannot be read (server stays authoritative)', async () => {
    const h = renderForm();
    act(() => {
      h.get().handlePhotoChange('file:///unknown.jpg');
    });
    await flush();
    expect(h.get().photoError).toBeNull();
    h.unmount();
  });

  it('blocks Review while the async photo error stands', async () => {
    FS.__setFileSize('file:///big.jpg', 6 * 1024 * 1024);
    const h = renderForm();
    fillValid(h);
    act(() => {
      h.get().handlePhotoChange('file:///big.jpg');
    });
    await flush();
    let result: any = 'unset';
    act(() => {
      result = h.get().review(location as any);
    });
    expect(result).toBeNull();
    expect(h.get().errors.photo).toMatch(/5 MB/);
    h.unmount();
  });

  it('removing the photo clears the error and unblocks Review', async () => {
    FS.__setFileSize('file:///big.jpg', 6 * 1024 * 1024);
    const h = renderForm();
    fillValid(h);
    act(() => {
      h.get().handlePhotoChange('file:///big.jpg');
    });
    await flush();
    expect(h.get().photoError).toMatch(/5 MB/);
    act(() => {
      h.get().handlePhotoChange(null);
    });
    expect(h.get().photoError).toBeNull();
    let result: any = null;
    act(() => {
      result = h.get().review(location as any);
    });
    expect(result).not.toBeNull();
    h.unmount();
  });
});

describe('touch targets >= 48dp across the field-incident flow (FIX 5)', () => {
  function pressableMinHeights(renderer: any): { label: string; minHeight: number }[] {
    return renderer.root
      .findAll((n: any) => n.type === 'Pressable' && typeof n.props?.accessibilityLabel === 'string')
      .map((n: any) => {
        const style = typeof n.props.style === 'function' ? n.props.style({ pressed: false }) : n.props.style;
        const flat = StyleSheet.flatten(style);
        return { label: n.props.accessibilityLabel, minHeight: flat?.minHeight };
      });
  }

  function expectAllBigEnough(renderer: any, where: string) {
    const found = pressableMinHeights(renderer);
    expect(found.length).toBeGreaterThan(0);
    for (const { label, minHeight } of found) {
      expect(typeof minHeight === 'number' && minHeight >= MIN_TOUCH_TARGET).toBe(true);
    }
    void where;
  }

  it('MIN_TOUCH_TARGET is 48', () => {
    expect(MIN_TOUCH_TARGET).toBe(48);
  });

  it('LocationCard Change-location button', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <LocationCard gps={{ status: 'error', fix: null, manual: false }} onOpenPicker={jest.fn()} />
      );
    });
    expectAllBigEnough(renderer, 'LocationCard');
  });

  it('PhotoPicker Remove and capture buttons', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <PhotoPicker photoUri="file:///a.jpg" photoError={null} onChange={jest.fn()} />
      );
    });
    expectAllBigEnough(renderer, 'PhotoPicker with photo');
    act(() => {
      renderer = create(<PhotoPicker photoUri={null} photoError={null} onChange={jest.fn()} />);
    });
    expectAllBigEnough(renderer, 'PhotoPicker empty');
  });

  it('ReviewIncidentScreen actions', () => {
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
    expectAllBigEnough(renderer, 'ReviewIncidentScreen');
  });

  it('MyIncidentsScreen filters, retry, and details buttons', () => {
    const failed = { ...storedRow('c', 'failed'), lastError: 'Rejected' };
    let renderer: any = null;
    act(() => {
      renderer = create(
        <MyIncidentsScreen
          incidents={[storedRow('a', 'pending'), failed]}
          syncing={false}
          onSyncNow={jest.fn()}
          onNewReport={jest.fn()}
          onRetryReport={jest.fn()}
        />
      );
    });
    // Activate the Clear-filters button too so it is measured as well.
    const search = renderer.root.findAll(
      (n: any) => n.props?.accessibilityLabel === 'Search by report ID or description'
    )[0];
    act(() => search.props.onChangeText('zzz'));
    expectAllBigEnough(renderer, 'MyIncidentsScreen');
  });

  it('SubmitResultScreen failed-state buttons', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(
        <SubmitResultScreen
          incident={validIncident()}
          status="failed"
          submitError="Rejected"
          onRetry={jest.fn()}
          onEditReport={jest.fn()}
          onGoToMyIncidents={jest.fn()}
          onNewReport={jest.fn()}
        />
      );
    });
    expectAllBigEnough(renderer, 'SubmitResultScreen failed');
  });

  it('NewFieldIncidentScreen GPS retry button', async () => {
    LocationMock.__setPermission('denied');
    let renderer: any = null;
    const { default: NewFieldIncidentScreen } = require('../screens/NewFieldIncidentScreen');
    await act(async () => {
      renderer = create(
        <NewFieldIncidentScreen onReview={jest.fn()} onOpenManualLocation={jest.fn()} />
      );
      await new Promise((r) => setTimeout(r, 0));
    });
    await flush();
    expectAllBigEnough(renderer, 'NewFieldIncidentScreen');
  });

  it('PrimaryButton meets the target', () => {
    let renderer: any = null;
    act(() => {
      renderer = create(<PrimaryButton label="Sync Now" onPress={jest.fn()} />);
    });
    expectAllBigEnough(renderer, 'PrimaryButton');
  });
});

describe('status contrast meets WCAG AA 4.5:1 (FIX 5)', () => {
  it.each([
    ['offline badge text', colors.offlineText, colors.offlineSoft],
    ['online badge text', colors.primaryDark, colors.primarySoft],
    ['failed badge text', colors.danger, colors.dangerSoft],
    ['primary button text', colors.white, colors.primary],
    ['add-incident button text', colors.white, colors.primaryDark],
    ['retry text on tint', colors.primaryDark, colors.primarySoft],
    ['body text', colors.text, colors.surface],
    ['muted text', colors.textMuted, colors.surface],
    ['link text', colors.primary, colors.surface],
    ['error text', colors.danger, colors.surface],
    ['warn badge text', colors.warnText, colors.warnSoft]
  ])('%s contrast is at least 4.5:1', (_label: string, fg: string, bg: string) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
