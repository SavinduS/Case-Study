import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { colors, font, radius, spacing } from '../theme';

// Live connectivity badge (wireframe: "Offline"). Follows ConnectivityService:
// green "Online" when reachable, amber "Offline" otherwise (including while
// the first check is still resolving — the offline-first safe default).
// Status is always stated in words, never by color alone.
export default function OfflineBadge() {
  const online = useOnlineStatus() === true;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={online ? 'Online status: online' : 'Offline status: offline'}
      style={[styles.badge, online ? styles.online : styles.offline]}
    >
      <View style={[styles.dot, online ? styles.dotOnline : styles.dotOffline]} />
      <Text style={[styles.text, online ? styles.textOnline : styles.textOffline]}>
        {online ? 'Online' : 'Offline'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: spacing.xs
  },
  offline: {
    backgroundColor: colors.warnSoft,
    borderColor: colors.warnText
  },
  online: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primaryDark
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  dotOffline: {
    backgroundColor: colors.warnText
  },
  dotOnline: {
    backgroundColor: colors.primaryDark
  },
  text: {
    fontSize: font.small,
    fontWeight: '700'
  },
  textOffline: {
    color: colors.warnText
  },
  textOnline: {
    color: colors.primaryDark
  }
});
