import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import RangerIcon, { type RangerIconName } from './RangerIcon';
import {
  statusLabelForIncident,
  type IncidentSyncStatus
} from '../services/incidentStorage';
import { colors, font, radius, spacing } from '../theme';

const CHIP: Record<
  IncidentSyncStatus,
  { icon: RangerIconName; border: string; bg: string; fg: string }
> = {
  pending: {
    icon: 'clock-outline',
    border: colors.offlineText,
    bg: colors.offlineSoft,
    fg: colors.offlineText
  },
  synced: {
    icon: 'check-circle-outline',
    border: colors.primary,
    bg: colors.primarySoft,
    fg: colors.primaryDark
  },
  failed: {
    icon: 'alert-circle-outline',
    border: colors.danger,
    bg: colors.dangerSoft,
    fg: colors.danger
  }
};

// Professional sync-status badge: icon plus words, never color alone.
export default function StatusChip({ status }: { status: IncidentSyncStatus }) {
  const chip = CHIP[status];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${statusLabelForIncident(status)}`}
      style={[styles.badge, { borderColor: chip.border, backgroundColor: chip.bg }]}
    >
      <RangerIcon name={chip.icon} size={14} color={chip.fg} />
      <Text style={[styles.label, { color: chip.fg }]}>
        {statusLabelForIncident(status).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1
  },
  label: {
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
