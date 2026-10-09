const { validateConflictReport, MAX_DESCRIPTION } = require('../utils/validateConflictReport');

const valid = {
  incidentType: 'elephant_sighting',
  location: { coordinates: [81.42, 6.62] },
  description: 'Two elephants near the fence',
  accuracyMeters: 4
};

describe('validateConflictReport', () => {
  test('accepts a valid app report without contact (anonymous app allowed)', () => {
    const result = validateConflictReport(valid, { method: 'app' });
    expect(result.ok).toBe(true);
    expect(result.value.incidentType).toBe('elephant_sighting');
    expect(result.value.location.coordinates).toEqual([81.42, 6.62]);
    expect(result.value.reporterContact).toBeUndefined();
  });

  test('E1: missing incident type and location', () => {
    const result = validateConflictReport({}, { method: 'app' });
    expect(result.ok).toBe(false);
    expect(result.errors.incidentType).toMatch(/required/i);
    expect(result.errors.location).toMatch(/required/i);
  });

  test('E1: rejects unknown incident type', () => {
    const result = validateConflictReport({ ...valid, incidentType: 'poacher' }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.incidentType).toBeDefined();
  });

  test('E1: rejects out-of-range coordinates', () => {
    const result = validateConflictReport(
      { ...valid, location: { coordinates: [999, 999] } },
      {}
    );
    expect(result.ok).toBe(false);
    expect(result.errors.location).toBeDefined();
  });

  test('SMS reports require a sender phone number', () => {
    const result = validateConflictReport(valid, { method: 'sms' });
    expect(result.ok).toBe(false);
    expect(result.errors.reporterContact).toBeDefined();

    const withContact = validateConflictReport(
      { ...valid, reporterContact: '+94771234567' },
      { method: 'sms' }
    );
    expect(withContact.ok).toBe(true);
    expect(withContact.value.reporterContact).toBe('+94771234567');
  });

  test('description is optional but length limited', () => {
    const long = 'x'.repeat(MAX_DESCRIPTION + 1);
    const result = validateConflictReport({ ...valid, description: long }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.description).toBeDefined();
  });

  test('accuracy must be a non-negative number', () => {
    const result = validateConflictReport({ ...valid, accuracyMeters: -5 }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.accuracyMeters).toBeDefined();
  });

  test('optional fields are normalized when provided', () => {
    const result = validateConflictReport(
      { ...valid, description: '  trim me  ', locationText: ' North ', photoUrl: '/uploads/a.jpg' },
      {}
    );
    expect(result.ok).toBe(true);
    expect(result.value.description).toBe('trim me');
    expect(result.value.locationText).toBe('North');
    expect(result.value.photoUrl).toBe('/uploads/a.jpg');
  });

  test('locationText and photoUrl must be strings when provided', () => {
    const result = validateConflictReport({ ...valid, locationText: 42, photoUrl: { url: 'x' } }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.locationText).toBeDefined();
    expect(result.errors.photoUrl).toBeDefined();
  });

  test('app reports may include a contact but it must look like a phone number', () => {
    const bad = validateConflictReport({ ...valid, reporterContact: '12' }, { method: 'app' });
    expect(bad.ok).toBe(false);
    expect(bad.errors.reporterContact).toBeDefined();

    const good = validateConflictReport({ ...valid, reporterContact: '+94771234567' }, { method: 'app' });
    expect(good.ok).toBe(true);
    expect(good.value.reporterContact).toBe('+94771234567');
  });

  test('non-string description is rejected', () => {
    const result = validateConflictReport({ ...valid, description: 12345 }, {});
    expect(result.ok).toBe(false);
    expect(result.errors.description).toBeDefined();
  });
});
