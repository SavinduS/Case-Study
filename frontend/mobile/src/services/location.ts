import * as Location from 'expo-location';

export interface GpsFix {
  coordinates: [number, number];
  accuracyMeters?: number;
}

export interface GpsState {
  status: 'detecting' | 'located' | 'error';
  fix: GpsFix | null;
  manual: boolean;
  error?: string;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentFix(): Promise<GpsFix> {
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });
  return {
    coordinates: [pos.coords.longitude, pos.coords.latitude],
    accuracyMeters:
      typeof pos.coords.accuracy === 'number' ? Math.round(pos.coords.accuracy) : undefined
  };
}
