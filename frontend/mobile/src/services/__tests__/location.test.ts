import * as Location from 'expo-location';
import { getCurrentFix, requestLocationPermission } from '../location';

const locationMock = Location as unknown as {
  requestForegroundPermissionsAsync: jest.Mock;
  getCurrentPositionAsync: jest.Mock;
};

describe('location', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requestLocationPermission resolves true only when granted', async () => {
    locationMock.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });
    await expect(requestLocationPermission()).resolves.toBe(true);
    locationMock.requestForegroundPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    await expect(requestLocationPermission()).resolves.toBe(false);
  });

  it('getCurrentFix returns [lng, lat] with rounded accuracy', async () => {
    locationMock.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { longitude: 81.5, latitude: 6.4, accuracy: 12.6 }
    });
    await expect(getCurrentFix()).resolves.toEqual({
      coordinates: [81.5, 6.4],
      accuracyMeters: 13
    });
    expect(locationMock.getCurrentPositionAsync).toHaveBeenCalledWith({
      accuracy: Location.Accuracy.Balanced
    });
  });

  it('getCurrentFix omits accuracy when the device does not report it', async () => {
    locationMock.getCurrentPositionAsync.mockResolvedValueOnce({
      coords: { longitude: 81.1, latitude: 6.1 }
    });
    await expect(getCurrentFix()).resolves.toEqual({
      coordinates: [81.1, 6.1],
      accuracyMeters: undefined
    });
  });
});
