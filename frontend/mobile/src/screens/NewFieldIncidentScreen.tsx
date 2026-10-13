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
import RangerIcon, { type RangerIconName } from '../components/RangerIcon';
import StatusBanner from '../components/StatusBanner';
import type { GpsFix } from '../services/location';
import { colors, font, MIN_TOUCH_TARGET, radius, spacing } from '../theme';
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
// Section heading with a professional icon. Wording, validation, and the
// Review → Edit → Submit flow are unchanged.
function SectionLabel({
  icon,
  children
}: {
  icon: RangerIconName;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.labelRow}>
      <RangerIcon name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.labelText}>{children}</Text>
    </View>
  );
}

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
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>New Incident</Text>
          <Text style={styles.headerSubtitle}>Capture a field report for offline storage and later sync.</Text>
        </View>
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

        <SectionLabel icon="calendar-clock-outline">Date and Time</SectionLabel>
        <View style={styles.card}>
          <Text accessibilityLabel={`Captured date and time: ${capturedLabel}`} style={styles.dateValue}>
            {capturedLabel}
          </Text>
          <Text style={styles.caption}>Automatically captured</Text>
        </View>

        <SectionLabel icon="crosshairs-gps">
          GPS Location <Text style={styles.required}>*</Text>
        </SectionLabel>
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

        <SectionLabel icon="clipboard-list-outline">
          Incident Type <Text style={styles.required}>*</Text>
        </SectionLabel>
        <FieldIncidentTypePicker
          value={form.incidentType}
          onChange={form.setIncidentType}
          error={form.attempted ? form.errors.incidentType : undefined}
        />

        <SectionLabel icon="pencil-outline">
          Description <Text style={styles.required}>*</Text>
        </SectionLabel>
        <DescriptionInput
          value={form.description}
          onChange={form.setDescription}
          error={form.attempted ? form.errors.description : undefined}
        />

        <SectionLabel icon="camera-outline">Photographic Evidence</SectionLabel>
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
  headerTextWrap: {
    flex: 1,
    marginRight: spacing.sm
  },
  headerTitle: {
    color: colors.white,
    fontSize: font.section,
    fontWeight: '800'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: font.small,
    marginTop: 2
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    backgroundColor: colors.bg
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm
  },
  labelText: {
    color: colors.textMuted,
    fontSize: font.tiny,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1
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
    minHeight: MIN_TOUCH_TARGET,
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