import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import IncidentTypePicker from '../components/IncidentTypePicker';
import LocationCard from '../components/LocationCard';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import type { GpsState } from '../services/location';
import { sectorLabel } from '../services/sectors';
import { colors, font, radius, spacing } from '../theme';
import type { Coordinates, IncidentType } from '../types';

export interface SubmitData {
  incidentType: IncidentType;
  location: { coordinates: Coordinates };
  description?: string;
  accuracyMeters?: number;
  locationText?: string;
}

interface Props {
  gps: GpsState;
  submitting: boolean;
  serverError: string | null;
  fieldErrors: Record<string, string> | null;
  photoUri: string | null;
  photoError: string | null;
  onSubmit: (data: SubmitData) => void;
  onOpenPicker: () => void;
  onPhotoChange: (uri: string | null) => void;
}

const MAX_DESCRIPTION = 500;

export default function SubmitReportScreen({
  gps,
  submitting,
  serverError,
  fieldErrors,
  photoUri,
  photoError,
  onSubmit,
  onOpenPicker,
  onPhotoChange
}: Props) {
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  const errors: Record<string, string> = { ...localErrors, ...(fieldErrors ?? {}) };

  function handleSubmit() {
    setAttempted(true);
    const nextErrors: Record<string, string> = {};
    if (!incidentType) {
      nextErrors.incidentType = 'Select the type of incident.';
    }
    if (gps.status !== 'located' || !gps.fix) {
      nextErrors.location =
        'Location is required. Use Change incident location to set it on the map.';
    }
    setLocalErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !incidentType || !gps.fix) return;

    const fix = gps.fix;
    onSubmit({
      incidentType,
      location: { coordinates: fix.coordinates },
      description: description.trim() ? description.trim() : undefined,
      accuracyMeters: gps.manual ? undefined : fix.accuracyMeters,
      locationText: sectorLabel(fix.coordinates[0], fix.coordinates[1]) ?? undefined
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <Text style={styles.appName}>Wildlife Alert</Text>
            <Text style={styles.title}>Submit Conflict Report</Text>
          </View>
        </View>

        {serverError ? <StatusBanner tone="error" title="Report not sent" message={serverError} /> : null}

        <Text style={styles.label}>
          What are you reporting? <Text style={styles.required}>*</Text>
        </Text>
        <IncidentTypePicker value={incidentType} onChange={setIncidentType} />
        {attempted && errors.incidentType ? (
          <Text style={styles.error}>{errors.incidentType}</Text>
        ) : null}

        <Text style={styles.label}>
          Incident location <Text style={styles.required}>*</Text>
        </Text>
        <LocationCard gps={gps} error={attempted ? errors.location : undefined} onOpenPicker={onOpenPicker} />

        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={styles.textarea}
          multiline
          maxLength={MAX_DESCRIPTION}
          placeholder="Describe what you observed…"
          placeholderTextColor={colors.textMuted}
          value={description}
          onChangeText={setDescription}
          accessibilityLabel="Description, optional"
        />
        <Text style={styles.counter}>
          {description.length}/{MAX_DESCRIPTION}
        </Text>

        <Text style={styles.label}>Photo (Optional)</Text>
        <PhotoPicker
          photoUri={photoUri}
          photoError={photoError}
          disabled={submitting}
          onChange={onPhotoChange}
        />

        <PrimaryButton
          label="Submit Report"
          onPress={handleSubmit}
          loading={submitting}
          disabled={submitting}
        />
        <Text style={styles.footnote}>
          Your report will be confirmed after it is received by the system.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md
  },
  titleText: {
    flex: 1
  },
  appName: {
    color: colors.primary,
    fontSize: font.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  title: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    marginTop: 2
  },
  label: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  required: {
    color: colors.danger
  },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 96,
    fontSize: font.body,
    color: colors.text,
    textAlignVertical: 'top'
  },
  counter: {
    color: colors.textMuted,
    fontSize: font.tiny,
    textAlign: 'right',
    marginBottom: spacing.md,
    marginTop: spacing.xs
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  },
  footnote: {
    color: colors.textMuted,
    fontSize: font.small,
    textAlign: 'center',
    marginTop: spacing.sm
  }
});
