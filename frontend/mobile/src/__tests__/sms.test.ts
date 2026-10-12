import { describe, expect, it } from 'vitest';
import {
  INCIDENT_ICONS,
  INCIDENT_LABELS,
  INCIDENT_TYPE_ORDER
} from '../constants/incidentTypes';
import { SMS_AREA_CODES, SMS_HOTLINE, SMS_TYPE_CODES } from '../constants/sms';

describe('SMS guide constants (shown on the SMS Guide tab)', () => {
  it('has the demo hotline as a dialable string', () => {
    // A placeholder, but it must stay phone-shaped: the SMS Guide tab builds
    // sms:/tel: links from it.
    expect(SMS_HOTLINE).toMatch(/^\+?[\d\s-]{7,}$/);
    expect(SMS_HOTLINE.replace(/\s/g, '')).toMatch(/^\+?\d+$/);
  });

  it('gives every incident type a label and an icon', () => {
    for (const type of INCIDENT_TYPE_ORDER) {
      expect(INCIDENT_LABELS[type].length).toBeGreaterThan(0);
      expect(INCIDENT_ICONS[type].length).toBeGreaterThan(0);
    }
  });

  it('derives type codes 1..5 in incident order — the backend SMS contract', () => {
    // backend/utils/smsParser.js maps "1".."5" in exactly this order; if the
    // list drifts, submitted SMS reports would describe the wrong incident.
    expect(SMS_TYPE_CODES.map((row) => row.code)).toEqual(['1', '2', '3', '4', '5']);
    expect(SMS_TYPE_CODES.map((row) => row.label)).toEqual(
      INCIDENT_TYPE_ORDER.map((type) => INCIDENT_LABELS[type])
    );
  });

  it('lists the four park boundary area codes the parser accepts', () => {
    expect(SMS_AREA_CODES).toEqual([
      'NORTHBOUNDARY',
      'EASTBOUNDARY',
      'SOUTHBOUNDARY',
      'WESTBOUNDARY'
    ]);
  });
});
