import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RangerIcon, { type RangerIconName } from './RangerIcon';
import { colors, font, radius, spacing } from '../theme';

export type RangerNavId = 'incidents' | 'report' | 'sync' | 'profile';

export interface RangerSidebarItem {
  id: RangerNavId;
  icon: RangerIconName;
  label: string;
}

export interface RangerSidebarUser {
  name: string;
  role: string;
}

/**
 * Ranger dashboard sidebar. Order: Incident Reports (default landing),
 * Add New Incident, Sync Reports, Ranger Profile, Logout last. Icons come
 * from the shared vector set; logic (storage/sync/auth) is untouched and
 * lives in the existing hooks and services.
 */
export const RANGER_SIDEBAR_ITEMS: RangerSidebarItem[] = [
  { id: 'incidents', icon: 'clipboard-text-outline', label: 'Incident Reports' },
  { id: 'report', icon: 'plus-circle-outline', label: 'Add New Incident' },
  { id: 'sync', icon: 'sync', label: 'Sync Reports' },
  { id: 'profile', icon: 'account-circle-outline', label: 'Ranger Profile' }
];

interface Props {
  active: 'incidents' | 'report' | 'profile';
  syncing: boolean;
  pendingCount: number;
  user: RangerSidebarUser;
  onSelect: (id: RangerNavId) => void;
  onSignOut: () => void;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function roleLabel(role: string): string {
  const trimmed = role.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : 'Ranger';
}

export default function RangerSidebar({ active, syncing, pendingCount, user, onSelect, onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="menu"
      accessibilityLabel="Ranger dashboard navigation"
      style={[styles.sidebar, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]}
    >
      <View style={styles.brand}>
        <View style={styles.brandBadge}>
          <RangerIcon name="leaf" size={20} color={colors.primaryDark} />
        </View>
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandTitle}>Ranger Dashboard</Text>
          <Text style={styles.brandSubtitle}>Wildlife Conservation</Text>
        </View>
      </View>

      <View
        accessibilityRole="text"
        accessibilityLabel={`Signed in as ${user.name}, ${roleLabel(user.role)}`}
        style={styles.profile}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialOf(user.name)}</Text>
        </View>
        <View style={styles.profileTextWrap}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={styles.profileRole}>{roleLabel(user.role)}</Text>
        </View>
      </View>

      <View style={styles.nav}>
        {RANGER_SIDEBAR_ITEMS.map((item) => {
          const isActive = active === item.id;
          const isSync = item.id === 'sync';
          const label = isSync && syncing ? 'Syncing…' : item.label;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive, disabled: isSync && syncing }}
              onPress={() => onSelect(item.id)}
              disabled={isSync && syncing}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.itemActive,
                pressed && styles.itemPressed
              ]}
            >
              <RangerIcon
                name={item.icon}
                size={20}
                color={isActive ? colors.white : 'rgba(255,255,255,0.85)'}
              />
              <Text style={[styles.itemLabel, isActive && styles.itemActiveText]}>{label}</Text>
              {isSync && pendingCount > 0 ? (
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Logout"
          onPress={onSignOut}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
        >
          <RangerIcon name="logout" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.itemLabel}>Logout</Text>
        </Pressable>
        <Text style={styles.footerHint}>Reports stay on this device while offline.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 264,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.sm,
    gap: spacing.md
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandTextWrap: {
    flex: 1
  },
  brandTitle: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: '800'
  },
  brandSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: font.small
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)'
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: '800'
  },
  profileTextWrap: {
    flex: 1
  },
  profileName: {
    color: colors.white,
    fontSize: font.body,
    fontWeight: '800'
  },
  profileRole: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: font.small,
    fontWeight: '600'
  },
  nav: {
    gap: spacing.xs
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md
  },
  itemActive: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderLeftWidth: 3,
    borderLeftColor: colors.white
  },
  itemPressed: {
    backgroundColor: 'rgba(255,255,255,0.10)'
  },
  itemLabel: {
    flex: 1,
    fontSize: font.body,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)'
  },
  itemActiveText: {
    color: colors.white,
    fontWeight: '800'
  },
  countBadge: {
    minWidth: 28,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2
  },
  countText: {
    color: colors.primaryDark,
    fontSize: font.tiny,
    fontWeight: '800'
  },
  footer: {
    marginTop: 'auto',
    gap: spacing.sm
  },
  footerHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: font.tiny,
    paddingHorizontal: spacing.md
  }
});
