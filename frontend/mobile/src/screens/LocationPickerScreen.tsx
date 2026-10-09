import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import PrimaryButton from '../components/PrimaryButton';
import { getCurrentFix, GpsFix, requestLocationPermission } from '../services/location';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  initialFix: GpsFix | null;
  initialManual: boolean;
  onConfirm: (fix: GpsFix) => void;
  onCancel: () => void;
}

// Fallback region: Yala park area (matching the backend supported sectors)
const DEFAULT_REGION: Region = {
  latitude: 6.48,
  longitude: 81.4,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08
};

export default function LocationPickerScreen({
  initialFix,
  initialManual,
  onConfirm,
  onCancel
}: Props) {
  const [pin, setPin] = useState<{ lng: number; lat: number }>(
    initialFix
      ? { lng: initialFix.coordinates[0], lat: initialFix.coordinates[1] }
      : { lng: DEFAULT_REGION.longitude, lat: DEFAULT_REGION.latitude }
  );
  const [manual, setManual] = useState(initialManual || !initialFix);
  const [detecting, setDetecting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const region = useMemo<Region>(
    () => ({
      latitude: pin.lat,
      longitude: pin.lng,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08
    }),
    [pin.lat, pin.lng]
  );

  async function detectCurrent() {
    setDetecting(true);
    setGpsError(null);
    const granted = await requestLocationPermission();
    if (!granted) {
      setGpsError('Location permission was denied.');
      setDetecting(false);
      return;
    }
    try {
      const fix = await getCurrentFix();
      setPin({ lng: fix.coordinates[0], lat: fix.coordinates[1] });
      setManual(false);
    } catch {
      setGpsError('GPS could not determine your position.');
    } finally {
      setDetecting(false);
    }
  }

  function confirm() {
    onConfirm({ coordinates: [pin.lng, pin.lat] });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to report form"
          onPress={onCancel}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Incident location</Text>
        <View style={styles.backSpacer} />
      </View>

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={region}
          onPress={(e) => {
            setPin({
              lng: e.nativeEvent.coordinate.longitude,
              lat: e.nativeEvent.coordinate.latitude
            });
            setManual(true);
          }}
        >
          <Marker
            draggable
            coordinate={{ latitude: pin.lat, longitude: pin.lng }}
            onDragEnd={(e) => {
              setPin({
                lng: e.nativeEvent.coordinate.longitude,
                lat: e.nativeEvent.coordinate.latitude
              });
              setManual(true);
            }}
          />
        </MapView>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelLabel}>Incident position</Text>
        <Text style={styles.coords}>
          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
        </Text>
        <Text style={styles.hint}>
          Tap the map or drag the pin to mark where the wildlife was seen.
        </Text>
        {gpsError ? <Text style={styles.error}>{gpsError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
          onPress={detectCurrent}
          disabled={detecting}
          style={({ pressed }) => [styles.detect, pressed && styles.detectPressed]}
        >
          <Text style={styles.detectText}>
            {detecting ? 'Detecting…' : '◎ Use my current location'}
          </Text>
        </Pressable>

        <PrimaryButton label="Use This Location" onPress={confirm} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  back: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  backPressed: {
    opacity: 0.6
  },
  backText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '600'
  },
  backSpacer: {
    width: 64
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  mapWrap: {
    flex: 1
  },
  map: {
    flex: 1
  },
  panel: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm
  },
  panelLabel: {
    color: colors.textMuted,
    fontSize: font.tiny,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  coords: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.small
  },
  error: {
    color: colors.danger,
    fontSize: font.small
  },
  detect: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft
  },
  detectPressed: {
    opacity: 0.7
  },
  detectText: {
    color: colors.primaryDark,
    fontSize: font.body,
    fontWeight: '600'
  }
});
