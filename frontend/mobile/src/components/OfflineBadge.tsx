import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

// Amber offline badge for the New Incident header (wireframe: "Offline").
// Status is always stated in words, never by color alone.
export default function OfflineBadge() {
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Offline status: offline"
      style={styles.badge}
    >
      <View style={styles.dot} />
      <Text style={styles.text}>Offline</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warnSoft,
    borderWidth: 1,
    borderColor: colors.warnText,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warnText
  },
  text: {
    color: colors.warnText,
    fontSize: font.small,
    fontWeight: '700'
  }
});