import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { INCIDENT_LABELS, INCIDENT_TYPE_ORDER } from '../constants/incidentTypes';
import { colors, font, radius, spacing } from '../theme';
import type { IncidentType } from '../types';

const OPTIONS: { value: IncidentType; label: string }[] = INCIDENT_TYPE_ORDER.map(
  (value) => ({ value, label: INCIDENT_LABELS[value] })
);

interface Props {
  value: IncidentType | null;
  onChange: (value: IncidentType) => void;
}

export default function IncidentTypePicker({ value, onChange }: Props) {
  return (
    <View style={styles.group}>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={[styles.radio, selected && styles.radioSelected]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <Text style={styles.label}>{option.label}</Text>
          </Pressable>
        );
      })}
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
  }
});
