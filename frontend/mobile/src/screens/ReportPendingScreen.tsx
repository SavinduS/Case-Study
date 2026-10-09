import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  localRef: string;
  onDone: () => void;
}

// Distinct from the success screen: the server has NOT accepted the report yet
export default function ReportPendingScreen({ localRef, onDone }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>↓</Text>
        </View>
        <Text style={styles.title}>Report saved on this device</Text>

        <StatusBanner
          tone="offline"
          title="Offline — report saved on this device, waiting to send."
          message="Report saved. It will be submitted automatically when connectivity returns. If the phone is online but it still will not send, check EXPO_PUBLIC_API_BASE_URL in frontend/mobile/.env — open My Reports to see the server connection status."
        />

        <Text style={styles.fieldLabel}>Local reference</Text>
        <Text style={styles.localRef}>{localRef}</Text>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>PENDING UPLOAD</Text>
        </View>

        <Text style={styles.note}>
          You will receive the official report ID (CR-…) after the system receives your
          report. Wildlife officers have NOT been notified yet.
        </Text>
      </View>

      <PrimaryButton label="Done" onPress={onDone} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.offlineSoft,
    borderWidth: 2,
    borderColor: colors.offlineText,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    alignSelf: 'center'
  },
  badgeIcon: {
    color: colors.offlineText,
    fontSize: 28,
    fontWeight: '800'
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.md
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: font.tiny,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm
  },
  localRef: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
    marginTop: 2
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.offlineText
  },
  statusText: {
    color: colors.offlineText,
    fontSize: font.section,
    fontWeight: '700'
  },
  note: {
    color: colors.textMuted,
    fontSize: font.small,
    marginTop: spacing.lg
  }
});
