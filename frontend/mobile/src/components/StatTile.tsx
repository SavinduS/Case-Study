import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RangerIcon, { type RangerIconName } from './RangerIcon';
import { colors, font, radius, spacing } from '../theme';

export type StatTone = 'total' | 'pending' | 'synced' | 'failed';

const TONE: Record<StatTone, { fg: string; bg: string }> = {
  total: { fg: colors.primaryDark, bg: colors.primarySoft },
  pending: { fg: colors.offlineText, bg: colors.offlineSoft },
  synced: { fg: colors.primaryDark, bg: colors.primarySoft },
  failed: { fg: colors.danger, bg: colors.dangerSoft }
};

interface Props {
  label: string;
  value: number;
  icon: RangerIconName;
  tone?: StatTone;
}

// Summary tile for the Incident Reports dashboard. Real counts only — the
// host passes values computed from stored reports.
export default function StatTile({ label, value, icon, tone = 'total' }: Props) {
  const t = TONE[tone];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
      style={styles.card}
    >
      <View style={[styles.iconWrap, { backgroundColor: t.bg }]}>
        <RangerIcon name={icon} size={18} color={t.fg} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 120,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-start',
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  value: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800'
  },
  label: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
});
