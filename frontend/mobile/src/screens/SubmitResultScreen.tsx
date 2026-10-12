import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { FIELD_INCIDENT_LABELS } from '../constants/fieldIncident';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  incident: ValidatedFieldIncident;
  onGoToMyIncidents: () => void;
  onNewReport: () => void;
  /** Storage status of the saved report (Alt Flow 3 direct submit ⇒ synced). */
  status?: 'pending' | 'synced';
  /** Server displayId (e.g. FI-2026-0001) when synchronized. */
  displayId?: string | null;
}

// F2: Submit Result — offline confirmation. The report is saved on-device;
// a synchronized report shows its server displayId (storyboard panel 9).
export default function SubmitResultScreen({
  incident,
  onGoToMyIncidents,
  onNewReport,
  status = 'pending',
  displayId
}: Props) {
  const synced = status === 'synced';
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>✓</Text>
        </View>
        <Text style={styles.title}>{synced ? 'Report Synchronized' : 'Report Saved Offline'}</Text>
        <Text style={styles.body}>
          {FIELD_INCIDENT_LABELS[incident.incidentType]} ·{' '}
          {new Date(incident.capturedAt).toLocaleString()}
        </Text>
        {synced && displayId ? <Text style={styles.body}>{displayId}</Text> : null}

        <StatusBanner
          tone="offline"
          title={
            synced ? 'Report synchronized' : 'Report saved offline — Pending Synchronization'
          }
          message={
            synced
              ? 'The central database confirmed receipt.'
              : 'It stays on this device and will sync when connectivity returns.'
          }
        />

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>
            {synced ? 'SYNCHRONIZED' : 'PENDING SYNCHRONIZATION'}
          </Text>
        </View>
      </View>

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
  statusText: {
    color: colors.offlineText,
    fontSize: font.section,
    fontWeight: '700'
  },
  secondaryWrap: {
    marginTop: spacing.sm
  }
});
