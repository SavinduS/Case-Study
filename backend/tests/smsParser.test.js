const { parseSms } = require('../utils/smsParser');

describe('parseSms', () => {
  test('parses numeric format with area code', () => {
    expect(parseSms('1 NORTHBOUNDARY')).toEqual({
      outcome: 'complete',
      areaCode: 'NORTHBOUNDARY',
      incidentType: 'elephant_sighting'
    });
  });

  test('parses keyword format', () => {
    expect(parseSms('WILD ELEPHANT NORTHBOUNDARY')).toMatchObject({
      outcome: 'complete',
      incidentType: 'elephant_sighting',
      areaCode: 'NORTHBOUNDARY'
    });
  });

  test('is case and separator insensitive', () => {
    expect(parseSms('2 west_boundary')).toMatchObject({
      outcome: 'complete',
      incidentType: 'crop_damage',
      areaCode: 'WESTBOUNDARY'
    });
  });

  test('recognizes digit menu replies', () => {
    expect(parseSms('4')).toEqual({
      outcome: 'menu_reply',
      typeCode: '4',
      incidentType: 'wildlife_blocking_road'
    });
  });

  test('flags missing area', () => {
    expect(parseSms('ELEPHANT')).toEqual({
      outcome: 'incomplete',
      missing: 'area',
      incidentType: 'elephant_sighting'
    });
  });

  test('flags missing type', () => {
    expect(parseSms('SOUTHBOUNDARY')).toEqual({
      outcome: 'incomplete',
      missing: 'type',
      areaCode: 'SOUTHBOUNDARY'
    });
  });

  test('flags unrecognized text', () => {
    expect(parseSms('xyz blah blah')).toEqual({ outcome: 'unrecognized' });
    expect(parseSms('')).toEqual({ outcome: 'unrecognized' });
    expect(parseSms(undefined)).toEqual({ outcome: 'unrecognized' });
  });
});
