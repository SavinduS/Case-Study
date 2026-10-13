import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { FIELD_INCIDENT_LABELS } from '../constants/fieldIncident';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { colors, font, radius, spacing } from '../theme';

export type SubmitResultStatus = 'pending' | 'synced' | 'failed';

interface Props {
  incident: ValidatedFieldIncident;
  onGoToMyIncidents: () => void;
  onNewReport: () => void;
  /** Storage status of the saved report (Alt Flow 3 direct submit ⇒ synced). */
  status?: SubmitResultStatus;
  /** Server displayId (e.g. FI-2026-0001) when synchronized. */
  displayId?: string | null;
  /** Server rejection reason for the failed state (Exc Flow 1). */
  submitError?: string | null;
  /** Re-attempts submission of the same reportId (no duplicate created). */
  onRetry?: () => void;
  /** Returns to the form with the draft preserved for correction. */
  onEditReport?: () => void;
}

// F2: Submit Result — offline confirmation, synchronized receipt, or failed
// rejection. A synchronized report shows its server displayId (storyboard
// panel 9); a failed report shows the rejection reason with Retry (same
// reportId) and Edit Report actions instead of stranding the ranger.
export default function SubmitResultScreen({
  incident,
  onGoToMyIncidents,
  onNewReport,
  status = 'pending',
  displayId,
  submitError,
  onRetry,
  onEditReport
}: Props) {
  const synced = status === 'synced';
  const failed = status === 'failed';
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={[styles.badge, failed ? styles.badgeFailed : synced ? styles.badgeSynced : null]}>
          <Text style={[styles.badgeIcon, failed ? styles.badgeIconFailed : synced ? styles.badgeIconSynced : null]}>
            {failed ? '!' : '✓'}
          </Text>
        </View>
        <Text style={styles.title}>
          {failed ? 'Report Not Accepted' : synced ? 'Report Synchronized' : 'Report Saved Offline'}
        </Text>
        <Text style={styles.body}>
          {FIELD_INCIDENT_LABELS[incident.incidentType]} ·{' '}
          {new Date(incident.capturedAt).toLocaleString()}
        </Text>
        {synced && displayId ? <Text style={styles.body}>{displayId}</Text> : null}

        <StatusBanner
          tone={failed ? 'error' : 'offline'}
          title={
            failed
              ? 'Report rejected by the server'
              : synced
                ? 'Report synchronized'
                : 'Report saved offline — Pending Synchronization'
          }
          message={
            failed
              ? (submitError ?? 'The server refused this report. Correct it or retry.')
              : synced
                ? 'The central database confirmed receipt.'
                : 'It stays on this device and will sync when connectivity returns.'
          }
        />

        <View style={styles.statusRow}>
          <View style={[styles.statusDot, failed ? styles.statusDotFailed : synced ? styles.statusDotSynced : null]} />
          <Text style={[styles.statusText, failed ? styles.statusTextFailed : synced ? styles.statusTextSynced : null]}>
            {failed ? 'FAILED' : synced ? 'SYNCHRONIZED' : 'PENDING SYNCHRONIZATION'}
          </Text>
        </View>
      </View>

      {failed && onRetry ? (
        <PrimaryButton label="Retry Submission" onPress={onRetry} />
      ) : null}
      {failed && onEditReport ? (
        <View style={styles.secondaryWrap}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit report"
            onPress={onEditReport}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Edit Report</Text>
          </Pressable>
        </View>
      ) : null}

      <PrimaryButton label="Go to My Incidents" onPress={onGoToMyIncidents} />
      <View style={styles.secondaryWrap}>
        <PrimaryButton label="New Incident Report" onPress={onNewReport} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.bg,
    gap: spacing.sm
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    alignItems: 'center'
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
    marginBottom: spacing.md
  },
  badgeIcon: {
    color: colors.offlineText,
    fontSize: 28,
    fontWeight: '800'
  },
  badgeSynced: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  badgeIconSynced: {
    color: colors.primaryDark
  },
  badgeFailed: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger
  },
  badgeIconFailed: {
    color: colors.danger
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.offlineText
  },
  statusDotSynced: {
    backgroundColor: colors.primary
  },
  statusDotFailed: {
    backgroundColor: colors.danger
  },
  statusText: {
    color: colors.offlineText,
    fontSize: font.section,
    fontWeight: '700'
  },
  statusTextSynced: {
    color: colors.primaryDark
  },
  statusTextFailed: {
    color: colors.danger
  },
  secondaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg
  },
  secondaryText: {
    color: colors.primaryDark,
    fontSize: font.section,
    fontWeight: '700'
  },
  pressed: {
    opacity: 0.7
  },
  secondaryWrap: {
    marginTop: spacing.sm
  }
});
