import { describe, it, expect } from 'vitest';
import {
  ALERT_STATUS,
  THREAT_LEVEL,
  COLLAR_STATUS,
  DISPATCH_STATE,
  ALERT_STATUS_LABEL,
  ALERT_STATUS_TONE,
  COLLAR_STATUS_LABEL,
  COLLAR_STATUS_TONE,
  THREAT_TONE,
  zoneKindLabel,
  zoneKindShort,
  OPEN_STATUSES,
  HANDLED_STATUSES,
  isOpen,
  formatGmt,
  formatGmtStamp
} from '../src/features/collar-alerts/domain/labels.js';

describe('status vocabulary', () => {
  it('maps every alert status to a label', () => {
    for (const status of Object.values(ALERT_STATUS)) {
      expect(ALERT_STATUS_LABEL[status]).toBeTruthy();
      expect(ALERT_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('calls a dismissed alert a false alarm, as the use case describes', () => {
    expect(ALERT_STATUS_LABEL[ALERT_STATUS.DISMISSED]).toBe('False alarm');
  });

  it('labels a delayed breach for the officer', () => {
    expect(ALERT_STATUS_LABEL[ALERT_STATUS.DELAYED]).toBe('Delayed incident');
  });

  it('gives every collar status a label and tone', () => {
    for (const status of Object.values(COLLAR_STATUS)) {
      expect(COLLAR_STATUS_LABEL[status]).toBeTruthy();
      expect(COLLAR_STATUS_TONE[status]).toBeTruthy();
    }
  });

  it('escalates the tone for critical and high threats alike', () => {
    expect(THREAT_TONE[THREAT_LEVEL.CRITICAL]).toBe('high');
    expect(THREAT_TONE[THREAT_LEVEL.MEDIUM]).toBe('medium');
    expect(THREAT_TONE[THREAT_LEVEL.LOW]).toBe('low');
  });

  it('describes each geofence kind for both the badge and the panel', () => {
    expect(zoneKindLabel('farmland')).toBe('Poaching Risk Zone');
    expect(zoneKindShort('farmland')).toBe('Farmland');
  });

  it('falls back for an unknown zone kind so no badge renders blank', () => {
    expect(zoneKindLabel('martian_base')).toBe('High-Risk Zone');
    expect(zoneKindShort('martian_base')).toBe('High-risk');
    expect(zoneKindLabel(undefined)).toBe('High-Risk Zone');
  });
});

describe('isOpen', () => {
  it('treats actionable alerts as open', () => {
    expect(OPEN_STATUSES).toEqual(['active', 'acknowledged', 'delayed']);
    for (const status of OPEN_STATUSES) expect(isOpen({ status })).toBe(true);
  });

  it('treats an actioned alert as closed', () => {
    expect(HANDLED_STATUSES).toEqual(['dismissed', 'resolved']);
    for (const status of HANDLED_STATUSES) expect(isOpen({ status })).toBe(false);
  });

  it('treats an unknown status as closed so it cannot block the queue', () => {
    expect(isOpen({ status: 'weird' })).toBe(false);
  });

  it('does not throw on a missing status', () => {
    expect(isOpen({})).toBe(false);
  });
});

describe('date formatting', () => {
  it('renders the breach time in GMT as the wireframe shows', () => {
    expect(formatGmt('2026-10-09T14:38:00Z')).toBe('14:38 GMT');
  });

  it('renders a full audit stamp', () => {
    expect(formatGmtStamp('2026-10-09T14:38:00Z')).toBe('09 Oct, 14:38');
  });

  it('does not shift the day because the machine is in another timezone', () => {
    // A late-evening GMT time can be the next day in a positive offset zone.
    expect(formatGmtStamp('2026-10-09T23:30:00Z')).toBe('09 Oct, 23:30');
  });
});

describe('dispatch states', () => {
  it('covers the states the retry log can hold', () => {
    expect(Object.values(DISPATCH_STATE).sort()).toEqual(['delivered', 'failed', 'idle', 'sending']);
  });
});
