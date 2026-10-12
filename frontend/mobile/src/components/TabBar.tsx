import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

export interface TabBarTab {
  id: string;
  icon: string;
  label: string;
}

/** Ranger: capture an incident in the field, then review what is still on the device. */
export const RANGER_TABS: TabBarTab[] = [
  { id: 'report', icon: '📝', label: 'Report Incident' },
  { id: 'myIncidents', icon: '📋', label: 'My Incidents' }
];

/** Villager: raise a conflict report, then track the reports sent from this phone. */
export const VILLAGER_TABS: TabBarTab[] = [
  { id: 'submit', icon: '🐘', label: 'Report Conflict' },
  { id: 'myReports', icon: '📄', label: 'My Reports' },
  { id: 'smsGuide', icon: '💬', label: 'SMS Guide' }
];

interface Props {
  tabs: TabBarTab[];
  active: string;
  onSelect: (id: string) => void;
  /** Shown on the right of the bar so a signed-in user can always sign out. */
  onSignOut?: () => void;
}

export default function TabBar({ tabs, active, onSelect, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            onPress={() => onSelect(tab.id)}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
          >
            <View style={[styles.pill, isActive && styles.pillActive]}>
              <Text style={[styles.icon, isActive && styles.activeText]}>{tab.icon}</Text>
              <Text style={[styles.label, isActive && styles.activeText]}>{tab.label}</Text>
            </View>
          </Pressable>
        );
      })}
      {onSignOut ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          onPress={onSignOut}
          style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
        >
          <Text style={[styles.icon, styles.activeText]}>🚪</Text>
          <Text style={[styles.label, styles.activeText]}>Sign out</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.sm
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48
  },
  pressed: {
    opacity: 0.6
  },
  pill: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg
  },
  pillActive: {
    backgroundColor: colors.primarySoft
  },
  icon: {
    fontSize: 18
  },
  label: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600'
  },
  activeText: {
    color: colors.primary,
    fontWeight: '700'
  }
});