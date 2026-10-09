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
}

// F2: Submit Result — offline confirmation. The report is saved on-device
// with "Pending Synchronization" status; real sync lands in F3.
export default function SubmitResultScreen({
  incident,
  onGoToMyIncidents,
  onNewReport
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.badge}>
          <Text style={styles.badgeIcon}>✓</Text>
        </View>
        <Text style={styles.title}>Report Saved Offline</Text>
        <Text style={styles.body}>
          {FIELD_INCIDENT_LABELS[incident.incidentType]} ·{' '}
          {new Date(incident.capturedAt).toLocaleString()}
        </Text>

        <StatusBanner
          tone="offline"
          title="Report saved offline — Pending Synchronization"
          message="It stays on this device and will sync when connectivity returns."
        />

        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>PENDING SYNCHRONIZATION</Text>
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
