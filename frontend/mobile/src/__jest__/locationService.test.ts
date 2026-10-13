import { getCurrentFix, requestLocationPermission } from '../services/location';

const LocationMock = require('expo-location');

describe('services/location', () => {
  beforeEach(() => LocationMock.__reset());

  it('requestLocationPermission returns true when granted', async () => {
    LocationMock.__setPermission('granted');
    await expect(requestLocationPermission()).resolves.toBe(true);
  });

  it('requestLocationPermission returns false when denied', async () => {
    LocationMock.__setPermission('denied');
    await expect(requestLocationPermission()).resolves.toBe(false);
  });

  it('getCurrentFix maps expo fix to GpsFix with rounded accuracy', async () => {
    LocationMock.__setFix({ coords: { longitude: 12.345678, latitude: -3.210987, accuracy: 8.6 } });
    const fix = await getCurrentFix();
    expect(fix.coordinates).toEqual([12.345678, -3.210987]);
    expect(fix.accuracyMeters).toBe(9);
  });

  it('getCurrentFix omits accuracy when expo gives non-number', async () => {
    LocationMock.__setFix({ coords: { longitude: 1, latitude: 2, accuracy: null } });
    const fix = await getCurrentFix();
    expect(fix.accuracyMeters).toBeUndefined();
  });

  it('getCurrentFix propagates expo errors', async () => {
    LocationMock.__setFixError(new Error('no satellites'));
    await expect(getCurrentFix()).rejects.toThrow('no satellites');
  });
});

