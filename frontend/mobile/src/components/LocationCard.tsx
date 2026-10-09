import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GpsState } from '../services/location';
import { sectorLabel } from '../services/sectors';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  gps: GpsState;
  error?: string;
  onOpenPicker: () => void;
}

export default function LocationCard({ gps, error, onOpenPicker }: Props) {
  return (
    <View>
      <View style={styles.card}>
        {gps.status === 'detecting' ? (
          <View style={styles.detecting}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.detectingText}>Detecting your location…</Text>
          </View>
        ) : gps.status === 'error' || !gps.fix ? (
          <View>
            <Text style={styles.unavailable}>Current location could not be detected.</Text>
            <Text style={styles.hint}>
              {gps.error ?? 'Use Change incident location to set where the incident happened.'}
            </Text>
          </View>
        ) : (
          <View>
            <Text style={styles.sector}>
              {sectorLabel(gps.fix.coordinates[0], gps.fix.coordinates[1]) ??
                'Selected location'}
            </Text>
            <Text style={styles.meta}>
              {gps.manual
                ? 'Manually selected point'
                : `GPS detected${gps.fix.accuracyMeters !== undefined ? ` · Accuracy ${gps.fix.accuracyMeters} m` : ''}`}
            </Text>
            <Text style={styles.coords}>
              {gps.fix.coordinates[1].toFixed(5)}, {gps.fix.coordinates[0].toFixed(5)}
            </Text>
            <Text style={styles.hint}>
              {gps.manual
                ? 'This is where you said the wildlife was seen.'
                : 'Detected from your position — confirm this is where the wildlife was seen.'}
            </Text>
          </View>
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change incident location"
        onPress={onOpenPicker}
        style={({ pressed }) => [styles.changeButton, pressed && styles.changePressed]}
      >
        <Text style={styles.changeText}>Change incident location →</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  detecting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56
  },
  detectingText: {
    color: colors.textMuted,
    fontSize: font.body
  },
  unavailable: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600'
  },
  sector: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  meta: {
    color: colors.primaryDark,
    fontSize: font.small,
    fontWeight: '600',
    marginTop: 2
  },
  coords: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: 2
  },
  hint: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: spacing.xs
  },
  changeButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: spacing.sm
  },
  changePressed: {
    opacity: 0.6
  },
  changeText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '600'
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  }
});
