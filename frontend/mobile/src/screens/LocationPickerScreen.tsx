import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import PrimaryButton from '../components/PrimaryButton';
import { getCurrentFix, GpsFix, requestLocationPermission } from '../services/location';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  initialFix: GpsFix | null;
  initialManual: boolean;
  onConfirm: (fix: GpsFix) => void;
  onCancel: () => void;
}

// Fallback centre: Yala park area (matching the backend supported sectors)
const DEFAULT_LAT = 6.48;
const DEFAULT_LNG = 81.4;

// Expo Go on Android cannot load Google Maps tiles (no API key can be injected
// into the Expo Go binary), so the picker uses Leaflet + OpenStreetMap in a WebView.
function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  (function () {
    var initial = { lat: ${lat}, lng: ${lng} };
    var map = L.map('map', { zoomControl: false }).setView([initial.lat, initial.lng], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    var marker = L.marker([initial.lat, initial.lng], { draggable: true }).addTo(map);
    function report(la, ln) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ lat: la, lng: ln }));
    }
    marker.on('dragend', function () {
      var p = marker.getLatLng();
      report(p.lat, p.lng);
    });
    map.on('click', function (e) {
      marker.setLatLng(e.latlng);
      report(e.latlng.lat, e.latlng.lng);
    });
    function onHostMessage(event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (err) { return; }
      if (msg && msg.type === 'setPin') {
        marker.setLatLng([msg.lat, msg.lng]);
        map.setView([msg.lat, msg.lng]);
      }
    }
    window.addEventListener('message', onHostMessage);
    document.addEventListener('message', onHostMessage);
  })();
</script>
</body>
</html>`;
}

export default function LocationPickerScreen({
  initialFix,
  initialManual,
  onConfirm,
  onCancel
}: Props) {
  const [pin, setPin] = useState<{ lng: number; lat: number }>(
    initialFix
      ? { lng: initialFix.coordinates[0], lat: initialFix.coordinates[1] }
      : { lng: DEFAULT_LNG, lat: DEFAULT_LAT }
  );
  const [manual, setManual] = useState(initialManual || !initialFix);
  const [detecting, setDetecting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const webRef = useRef<WebView>(null);
  const initialLat = initialFix ? initialFix.coordinates[1] : DEFAULT_LAT;
  const initialLng = initialFix ? initialFix.coordinates[0] : DEFAULT_LNG;
  // Memo must not depend on live pin — taps/drag update the map via messages only,
  // so the WebView never reloads.
  const mapHtml = useMemo(() => buildMapHtml(initialLat, initialLng), [initialLat, initialLng]);

  function handleMapMessage(event: { nativeEvent: { data: string } }) {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (typeof msg?.lat === 'number' && typeof msg?.lng === 'number') {
        setPin({ lat: msg.lat, lng: msg.lng });
        setManual(true);
      }
    } catch {
      // ignore malformed messages
    }
  }

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
      webRef.current?.postMessage(
        JSON.stringify({ type: 'setPin', lat: fix.coordinates[1], lng: fix.coordinates[0] })
      );
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
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          onMessage={handleMapMessage}
          androidLayerType="hardware"
          textZoom={100}
          style={styles.map}
        />
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
