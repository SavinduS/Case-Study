import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';
import { FIELD_INCIDENT_LABELS, FIELD_INCIDENT_TYPE_ORDER } from '../constants/fieldIncident';
import type { FieldIncidentType } from '../fieldIncidentTypes';

interface Props {
  value: FieldIncidentType | null;
  onChange: (value: FieldIncidentType) => void;
  error?: string;
}

// Ranger incident types. Mirrors the shared IncidentTypePicker interaction
// (radio rows) but with this use case's own values, so the shared picker for
// villager conflict reports stays untouched.
export default function FieldIncidentTypePicker({ value, onChange, error }: Props) {
  return (
    <View>
      <View style={[styles.group, error ? styles.groupInvalid : null]}>
        {FIELD_INCIDENT_TYPE_ORDER.map((option) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={FIELD_INCIDENT_LABELS[option]}
              onPress={() => onChange(option)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
              <Text style={styles.label}>{FIELD_INCIDENT_LABELS[option]}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md
  },
  groupInvalid: {
    borderColor: colors.danger
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  rowPressed: {
    backgroundColor: colors.primarySoft
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioSelected: {
    borderColor: colors.primary
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary
  },
  label: {
    fontSize: font.body,
    color: colors.text
  },
  error: {
    color: colors.danger,
    fontSize: font.small,
    marginTop: spacing.xs
  }
});