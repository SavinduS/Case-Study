import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export type TabId = 'form' | 'myReports' | 'smsGuide';

interface Props {
  active: TabId;
  onSelect: (tab: TabId) => void;
}

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'form', icon: '📝', label: 'Submit Report' },
  { id: 'myReports', icon: '📋', label: 'My Reports' },
  { id: 'smsGuide', icon: '💬', label: 'SMS Guide' }
];

export default function TabBar({ active, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
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
            <Text style={[styles.icon, isActive && styles.activeText]}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.activeText]}>{tab.label}</Text>
          </Pressable>
        );
      })}
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
