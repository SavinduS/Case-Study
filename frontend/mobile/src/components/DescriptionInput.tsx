import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { MAX_DESCRIPTION_LENGTH } from '../constants/fieldIncident';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

// Multiline description with a live character counter (max 500).
export default function DescriptionInput({ value, onChange, error }: Props) {
  return (
    <View>
      <TextInput
        style={[styles.textarea, error ? styles.textareaInvalid : null]}
        multiline
        maxLength={MAX_DESCRIPTION_LENGTH}
        placeholder="Describe what you observed..."
        placeholderTextColor={colors.textMuted}
        value={value}
        onChangeText={onChange}
        accessibilityLabel="Incident description"
      />
      <View style={styles.metaRow}>
        {error ? <Text style={styles.error}>{error}</Text> : <View style={styles.errorSpacer} />}
        <Text style={styles.counter}>
          {value.length}/{MAX_DESCRIPTION_LENGTH}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  textareaInvalid: {
    borderColor: colors.danger
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: spacing.xs
  },
  errorSpacer: {
    flex: 1
  },
  error: {
    flex: 1,
    color: colors.danger,
    fontSize: font.small,
    marginRight: spacing.sm
  },
  counter: {
    color: colors.textMuted,
    fontSize: font.tiny,
    textAlign: 'right'
  }
});