import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import LocationCard from '../components/LocationCard';
import PhotoPicker from '../components/PhotoPicker';
import PrimaryButton from '../components/PrimaryButton';
import StatusBanner from '../components/StatusBanner';
import type { GpsFix } from '../services/location';
import { colors, font, radius, spacing } from '../theme';
import DescriptionInput from '../components/DescriptionInput';
import FieldIncidentTypePicker from '../components/FieldIncidentTypePicker';
import OfflineBadge from '../components/OfflineBadge';
import { OFFLINE_MESSAGE } from '../constants/fieldIncident';
import { useFieldIncidentForm } from '../hooks/useFieldIncidentForm';
import { useFieldIncidentLocation } from '../hooks/useFieldIncidentLocation';
import type { FieldIncidentDraft, ValidatedFieldIncident } from '../fieldIncidentTypes';

interface Props {
  initialDraft?: Partial<FieldIncidentDraft>;
  /** Pin handed back from the shared map picker (LocationPickerScreen). */
  manualFix?: GpsFix | null;
  /** F1 ends here: the host (F2) shows the review screen from this draft. */
  onReview: (incident: ValidatedFieldIncident) => void;
  /** Host shows the shared LocationPickerScreen for manual selection. */
  onOpenManualLocation: () => void;
}

// F1: Field Incident Capture Form (use-case main flow 1-10, Alt 1, Exc 1).
// Date/time auto-captured read-only, GPS card with manual fallback, incident
// type, 500-char description, photo evidence, offline badge + notice, and a
// Review Incident button. No persistence / API / sync here (later features).
export default function NewFieldIncidentScreen({
  initialDraft,
  manualFix,
  onReview,
  onOpenManualLocation
}: Props) {
  const form = useFieldIncidentForm({ initialDraft });
  const fieldLocation = useFieldIncidentLocation({ externalFix: manualFix ?? null });

  const hasErrors = Object.keys(form.errors).length > 0;
  const capturedLabel = new Date(form.capturedAt).toLocaleString();

  function handleReviewPress() {
    const result = form.review(fieldLocation.location);
    if (result) onReview(result);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Incident</Text>
        <OfflineBadge />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {form.attempted && hasErrors ? (
          <StatusBanner
            tone="error"
            title="Check the highlighted fields"
            message="Some required information is missing."
          />
        ) : null}

        <Text style={styles.label}>Date and Time</Text>
        <View style={styles.card}>
          <Text accessibilityLabel={`Captured date and time: ${capturedLabel}`} style={styles.dateValue}>
            {capturedLabel}
          </Text>
          <Text style={styles.caption}>Automatically captured</Text>
        </View>

        <Text style={styles.label}>
          GPS Location <Text style={styles.required}>*</Text>
        </Text>
        <LocationCard
          gps={fieldLocation.gps}
          error={form.attempted ? form.errors.location : undefined}
          onOpenPicker={onOpenManualLocation}
        />
        {fieldLocation.gps.status === 'error' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry GPS detection"
            onPress={fieldLocation.retry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.retryPressed]}
          >
            <Text style={styles.retryText}>Retry GPS detection</Text>
          </Pressable>
        ) : null}

        <Text style={styles.label}>
          Incident Type <Text style={styles.required}>*</Text>
        </Text>
        <FieldIncidentTypePicker
          value={form.incidentType}
          onChange={form.setIncidentType}
          error={form.attempted ? form.errors.incidentType : undefined}
        />

        <Text style={styles.label}>
          Description <Text style={styles.required}>*</Text>
        </Text>
        <DescriptionInput
          value={form.description}
          onChange={form.setDescription}
          error={form.attempted ? form.errors.description : undefined}
        />

        <Text style={styles.label}>Photographic Evidence</Text>
        <PhotoPicker
          photoUri={form.photoUri}
          photoError={form.photoError}
          onChange={form.handlePhotoChange}
        />

        <View style={styles.noticeWrap}>
          <StatusBanner
            tone="offline"
            title="Works offline"
            message={OFFLINE_MESSAGE}
          />
        </View>

        <PrimaryButton label="Review Incident" onPress={handleReviewPress} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  headerTitle: {
    color: colors.white,
    fontSize: font.section,
    fontWeight: '700'
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg
  },
  label: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  required: {
    color: colors.danger
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md
  },
  dateValue: {
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  },
  caption: {
    color: colors.textMuted,
    fontSize: font.small,
    fontStyle: 'italic',
    marginTop: 2
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.sm
  },
  retryPressed: {
    opacity: 0.7
  },
  retryText: {
    color: colors.primaryDark,
    fontSize: font.body,
    fontWeight: '600'
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  },
  noticeWrap: {
    marginTop: spacing.md
  }
});