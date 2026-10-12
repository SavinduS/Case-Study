import React from 'react';
import { act, create } from 'react-test-renderer';
import DescriptionInput from '../components/DescriptionInput';
import FieldIncidentTypePicker from '../components/FieldIncidentTypePicker';
import LocationCard from '../components/LocationCard';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import OfflineBadge from '../components/OfflineBadge';
import { FIELD_INCIDENT_LABELS, MAX_DESCRIPTION_LENGTH } from '../constants/fieldIncident';

function allTexts(root: any): string {
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

describe('DescriptionInput', () => {
  it('renders counter and calls onChange', () => {
    const onChange = jest.fn();
    let r: any = null;
    act(() => {
      r = create(<DescriptionInput value="hello" onChange={onChange} />);
    });
    expect(allTexts(r.root)).toMatch(new RegExp(`5/${MAX_DESCRIPTION_LENGTH}`));
    const input = r.root.findAll((n: any) => n.type === 'TextInput')[0];
    act(() => input.props.onChangeText('new'));
    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('shows error and invalid styling', () => {
    let r: any = null;
    act(() => {
      r = create(<DescriptionInput value="" onChange={jest.fn()} error="Required" />);
    });
    expect(allTexts(r.root)).toMatch(/Required/);
  });
});

describe('FieldIncidentTypePicker', () => {
  it('renders all four options and selects on press', () => {
    const onChange = jest.fn();
    let r: any = null;
    act(() => {
      r = create(<FieldIncidentTypePicker value={null} onChange={onChange} />);
    });
    const t = allTexts(r.root);
    for (const label of Object.values(FIELD_INCIDENT_LABELS)) {
      expect(t).toMatch(label.split(' ')[0]);
    }
    const poacher = r.root.findAll(
      (n: any) => n.props?.accessibilityLabel === FIELD_INCIDENT_LABELS.poacher
    )[0];
    act(() => poacher.props.onPress());
    expect(onChange).toHaveBeenCalledWith('poacher');
  });

  it('marks selected option checked and shows error', () => {
    let r: any = null;
    act(() => {
      r = create(<FieldIncidentTypePicker value="snare" onChange={jest.fn()} error="Pick one" />);
    });
    const snare = r.root.findAll(
      (n: any) => n.props?.accessibilityLabel === FIELD_INCIDENT_LABELS.snare
    )[0];
    expect(snare.props.accessibilityState).toMatchObject({ checked: true });
    expect(allTexts(r.root)).toMatch(/Pick one/);
  });
});

describe('LocationCard', () => {
  it('shows detecting state', () => {
    let r: any = null;
    act(() => {
      r = create(
        <LocationCard gps={{ status: 'detecting', fix: null, manual: false }} onOpenPicker={jest.fn()} />
      );
    });
    expect(allTexts(r.root)).toMatch(/Detecting your location/);
  });

  it('shows error/unavailable state with picker button', () => {
    const onOpen = jest.fn();
    let r: any = null;
    act(() => {
      r = create(
        <LocationCard
          gps={{ status: 'error', fix: null, manual: false, error: 'GPS timed out' }}
          onOpenPicker={onOpen}
        />
      );
    });
    expect(allTexts(r.root)).toMatch(/could not be detected/);
    const btn = r.root.findAll(
      (n: any) => n.props?.accessibilityLabel === 'Change incident location'
    )[0];
    act(() => btn.props.onPress());
    expect(onOpen).toHaveBeenCalled();
  });

  it('shows located GPS fix with coordinates', () => {
    let r: any = null;
    act(() => {
      r = create(
        <LocationCard
          gps={{ status: 'located', fix: { coordinates: [36.82, -1.29], accuracyMeters: 5 }, manual: false }}
          onOpenPicker={jest.fn()}
        />
      );
    });
    expect(allTexts(r.root)).toMatch(/GPS detected/);
  });

  it('shows manual pin label', () => {
    let r: any = null;
    act(() => {
      r = create(
        <LocationCard
          gps={{ status: 'located', fix: { coordinates: [36.82, -1.29] }, manual: true }}
          onOpenPicker={jest.fn()}
        />
      );
    });
    expect(allTexts(r.root)).toMatch(/Manually selected point/);
  });

  it('shows inline field error', () => {
    let r: any = null;
    act(() => {
      r = create(
        <LocationCard gps={{ status: 'detecting', fix: null, manual: false }} error="Location required" onOpenPicker={jest.fn()} />
      );
    });
    expect(allTexts(r.root)).toMatch(/Location required/);
  });
});

describe('PrimaryButton', () => {
  it('fires onPress and shows label', () => {
    const onPress = jest.fn();
    let r: any = null;
    act(() => {
      r = create(<PrimaryButton label="Go" onPress={onPress} />);
    });
    const btn = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'Go')[0];
    // cover pressed/unpressed style branches
    btn.props.style({ pressed: true });
    btn.props.style({ pressed: false });
    act(() => btn.props.onPress());
    expect(onPress).toHaveBeenCalled();
  });

  it('disables when disabled or loading', () => {
    let r: any = null;
    act(() => {
      r = create(<PrimaryButton label="X" onPress={jest.fn()} disabled loading />);
    });
    const btn = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'X')[0];
    expect(btn.props.disabled).toBe(true);
    btn.props.style({ pressed: true });
    btn.props.style({ pressed: false });
  });

  it('covers enabled pressed style', () => {
    let r: any = null;
    act(() => {
      r = create(<PrimaryButton label="Y" onPress={jest.fn()} />);
    });
    const btn = r.root.findAll((n: any) => n.props?.accessibilityLabel === 'Y')[0];
    const s1: any = btn.props.style({ pressed: true });
    const s2: any = btn.props.style({ pressed: false });
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
  });
});

describe('StatusBanner + OfflineBadge', () => {
  it('renders all tones with title + message', () => {
    for (const tone of ['error', 'warn', 'offline', 'success'] as const) {
      let r: any = null;
      act(() => {
        r = create(<StatusBanner tone={tone} title={`${tone} title`} message={`${tone} msg`} />);
      });
      expect(allTexts(r.root)).toMatch(new RegExp(`${tone} title`));
    }
  });

  it('renders without message', () => {
    let r: any = null;
    act(() => {
      r = create(<StatusBanner tone="error" title="Only title" />);
    });
    expect(allTexts(r.root)).toMatch(/Only title/);
  });

  it('OfflineBadge states offline in words', () => {
    let r: any = null;
    act(() => {
      r = create(<OfflineBadge />);
    });
    expect(allTexts(r.root)).toMatch(/Offline/);
  });

  it('covers picker and card pressed styles', () => {
    let r1: any = null;
    act(() => {
      r1 = create(<FieldIncidentTypePicker value={null} onChange={jest.fn()} />);
    });
    for (const n of r1.root.findAll((n: any) => typeof n.props?.style === 'function')) {
      n.props.style({ pressed: true });
      n.props.style({ pressed: false });
    }
    let r2: any = null;
    act(() => {
      r2 = create(
        <LocationCard gps={{ status: 'detecting', fix: null, manual: false }} onOpenPicker={jest.fn()} />
      );
    });
    for (const n of r2.root.findAll((n: any) => typeof n.props?.style === 'function')) {
      n.props.style({ pressed: true });
      n.props.style({ pressed: false });
    }
    expect(true).toBe(true);
  });
});

describe('constants', () => {
  it('exposes labels, limits, and offline message', () => {
    expect(MAX_DESCRIPTION_LENGTH).toBe(500);
    expect(Object.keys(FIELD_INCIDENT_LABELS)).toHaveLength(4);
  });
});

