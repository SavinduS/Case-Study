import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import { colors, font, radius, spacing } from '../theme';
import type { ConflictReportConfirmation } from '../types';

interface Props {
  confirmation: ConflictReportConfirmation;
  onDone: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function ReportSuccessScreen({ confirmation, onDone }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>✓</Text>
        </View>
        <Text style={styles.title}>Report Submitted Successfully</Text>
        <Text style={styles.body}>Your conflict report has been successfully received.</Text>

        <Text style={styles.fieldLabel}>Report ID</Text>
        <Text style={styles.reportId}>{confirmation.reportId}</Text>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>{confirmation.status}</Text>
        </View>

        <Text style={styles.fieldLabel}>Date &amp; Time</Text>
        <Text style={styles.value}>{formatDateTime(confirmation.createdAt)}</Text>

        <Text style={styles.note}>Wildlife officers have been notified.</Text>

        {confirmation.isPossibleDuplicate && confirmation.duplicateOfReportId ? (
          <View style={styles.duplicate}>
            <Text style={styles.duplicateTitle}>Possible duplicate</Text>
            <Text style={styles.duplicateText}>
              This report was linked to {confirmation.duplicateOfReportId}. Officers will
              review both reports.
            </Text>
          </View>
        ) : null}
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
    marginBottom: spacing.lg,
    alignItems: 'center'
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  badgeIcon: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '800'
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center'
  },
  body: {
    color: colors.textMuted,
    fontSize: font.body,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md
  },
  fieldLabel: {
    alignSelf: 'flex-start',
    color: colors.textMuted,
    fontSize: font.tiny,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.sm
  },
  reportId: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
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
    backgroundColor: colors.primary
  },
  statusText: {
    color: colors.primaryDark,
    fontSize: font.section,
    fontWeight: '700'
  },
  value: {
    color: colors.text,
    fontSize: font.body,
    marginTop: 2
  },
  note: {
    color: colors.text,
    fontSize: font.small,
    marginTop: spacing.lg,
    textAlign: 'center'
  },
  duplicate: {
    backgroundColor: colors.warnSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    width: '100%'
  },
  duplicateTitle: {
    color: colors.warnText,
    fontSize: font.small,
    fontWeight: '700'
  },
  duplicateText: {
    color: colors.warnText,
    fontSize: font.tiny,
    marginTop: 2
  }
});
