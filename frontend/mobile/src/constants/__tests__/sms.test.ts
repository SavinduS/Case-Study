import { INCIDENT_LABELS, INCIDENT_TYPE_ORDER } from '../incidentTypes';
import { SMS_AREA_CODES, SMS_HOTLINE, SMS_TYPE_CODES } from '../sms';

describe('incidentTypes', () => {
  it('labels every incident type exactly once', () => {
    expect(INCIDENT_TYPE_ORDER).toEqual([
      'elephant_sighting',
      'crop_damage',
      'wildlife_near_home',
      'wildlife_blocking_road',
      'other_wildlife_conflict'
    ]);
    for (const type of INCIDENT_TYPE_ORDER) {
      expect(INCIDENT_LABELS[type]).toBeTruthy();
    }
  });
});

describe('sms constants', () => {
  it('exposes the demo hotline number', () => {
    expect(SMS_HOTLINE).toBe('011 234 5678');
  });

  it('maps type codes 1..5 in backend smsParser order', () => {
    expect(SMS_TYPE_CODES).toHaveLength(5);
    expect(SMS_TYPE_CODES.map((r) => r.code)).toEqual(['1', '2', '3', '4', '5']);
    expect(SMS_TYPE_CODES.map((r) => r.label)).toEqual(INCIDENT_TYPE_ORDER.map((t) => INCIDENT_LABELS[t]));
  });

  it('lists the four boundary area codes', () => {
    expect(SMS_AREA_CODES).toEqual([
      'NORTHBOUNDARY',
      'EASTBOUNDARY',
      'SOUTHBOUNDARY',
      'WESTBOUNDARY'
    ]);
  });
});
