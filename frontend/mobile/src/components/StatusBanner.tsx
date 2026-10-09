import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme';

type Tone = 'error' | 'warn' | 'offline' | 'success';

interface Props {
  tone: Tone;
  title: string;
  message?: string;
}

const TONES: Record<Tone, { bg: string; fg: string; icon: string }> = {
  error: { bg: colors.dangerSoft, fg: colors.danger, icon: '!' },
  warn: { bg: colors.warnSoft, fg: colors.warnText, icon: '!' },
  offline: { bg: colors.offlineSoft, fg: colors.offlineText, icon: '↓' },
  success: { bg: colors.primarySoft, fg: colors.primaryDark, icon: '✓' }
};

// Status is always stated in words, never by color alone
export default function StatusBanner({ tone, title, message }: Props) {
  const style = TONES[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: style.bg }]}>
      <View style={[styles.iconWrap, { borderColor: style.fg }]}>
        <Text style={[styles.icon, { color: style.fg }]}>{style.icon}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: style.fg }]}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  icon: {
    fontSize: font.small,
    fontWeight: '800'
  },
  textWrap: {
    flex: 1
  },
  title: {
    fontSize: font.body,
    fontWeight: '700'
  },
  message: {
    color: colors.text,
    fontSize: font.small,
    marginTop: 2
  }
});
