import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import SignOutButton from '../components/SignOutButton';
import type { AuthSession } from '../auth/types';
import { colors, font, radius, spacing } from '../theme';

interface Props {
  user: AuthSession;
  onSignOut?: () => void;
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function ProfileScreen({ user, onSignOut }: Props) {
  return (
    <View style={styles.container}>
      <ScreenHeader
        title="My Profile"
        right={onSignOut ? <SignOutButton onPress={onSignOut} /> : undefined}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialOf(user.name)}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <View style={styles.roleChip}>
            <Text style={styles.roleChipText}>{roleLabel(user.role)}</Text>
          </View>

          <View style={styles.rows}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Phone</Text>
              <Text style={styles.rowValue}>{user.phone ?? '—'}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user.email ?? '—'}</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Account ID</Text>
              <Text style={styles.rowId}>{user.id}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center'
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '800'
  },
  name: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '800',
    textAlign: 'center'
  },
  roleChip: {
    marginTop: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4
  },
  roleChipText: {
    color: colors.primaryDark,
    fontSize: font.tiny,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  rows: {
    alignSelf: 'stretch',
    marginTop: spacing.lg
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  rowLabel: {
    color: colors.textMuted,
    fontSize: font.small,
    fontWeight: '600'
  },
  rowValue: {
    flex: 1,
    color: colors.text,
    fontSize: font.body,
    fontWeight: '600',
    textAlign: 'right'
  },
  rowId: {
    flex: 1,
    color: colors.textMuted,
    fontSize: font.tiny,
    textAlign: 'right'
  }
});
