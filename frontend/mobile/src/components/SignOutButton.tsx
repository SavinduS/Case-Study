import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, font, MIN_TOUCH_TARGET, spacing } from '../theme';

interface Props {
  onPress: () => void;
}

export default function SignOutButton({ onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Sign out"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.text}>Sign out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm
  },
  pressed: {
    opacity: 0.6
  },
  text: {
    color: colors.danger,
    fontSize: font.small,
    fontWeight: '700'
  }
});
