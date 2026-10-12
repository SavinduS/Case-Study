import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import OfflineBadge from '../components/OfflineBadge';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import { FIELD_INCIDENT_LABELS, OFFLINE_MESSAGE } from '../constants/fieldIncident';
import type { ValidatedFieldIncident } from '../fieldIncidentTypes';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  incident: ValidatedFieldIncident;
  onEdit: () => void;
  onSubmit: () => void;
  onChangeLocation: () => void;
}

// F2: Review Incident — read-only summary of the F1 draft.
// Edit returns to the form with values preserved (host passes
// initialDraft + manualFix). Submit saves offline and shows result.
export default function ReviewIncidentScreen({
  incident,
  onEdit,
  onSubmit,
  onChangeLocation
}: Props) {
  const [lon, lat] = incident.location.coordinates;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Review Incident</Text>
        <OfflineBadge />
      </View>

      <StatusBanner tone="offline" title="Works offline" message={OFFLINE_MESSAGE} />

      <View style={styles.card}>
        <Text style={styles.label}>Date and Time</Text>
        <Text style={styles.value}>{new Date(incident.capturedAt).toLocaleString()}</Text>

        <Text style={styles.label}>GPS Location</Text>
        <Text style={styles.value}>
          {lat.toFixed(5)}, {lon.toFixed(5)}
          {incident.location.manual ? ' (manual pin)' : ' (GPS)'}
        </Text>

        <Text style={styles.label}>Incident Type</Text>
        <Text style={styles.value}>{FIELD_INCIDENT_LABELS[incident.incidentType]}</Text>

        <Text style={styles.label}>Description</Text>
        <Text style={styles.value}>{incident.description}</Text>

        <Text style={styles.label}>Photo</Text>
        <Text style={styles.value}>{incident.photoUri ? 'Attached' : 'None'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Change incident location"
        onPress={onChangeLocation}
        style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
      >
        <Text style={styles.linkText}>Change incident location →</Text>
      </Pressable>

      <View style={styles.buttonRow}>
        <PrimaryButton label="Submit Report" onPress={onSubmit} />
      </View>
      <View style={styles.buttonRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit report"
          onPress={onEdit}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>Edit Report</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  title: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4
  },
  label: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.xs
  },
  value: {
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600'
  },
  linkButton: {
    minHeight: 44,
    justifyContent: 'center'
  },
  linkText: {
    color: colors.primary,
    fontSize: font.body,
    fontWeight: '600'
  },
  buttonRow: {
    marginTop: spacing.sm
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
  }
});
