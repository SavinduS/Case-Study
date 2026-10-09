import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

interface Props {
  title: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

const SIDE_WIDTH = 70;

export default function ScreenHeader({ title, left, right }: Props) {
  return (
    <View style={styles.bar}>
      {left ?? <View style={styles.side} />}
      <Text style={styles.title}>{title}</Text>
      {right ?? <View style={styles.side} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  side: {
    width: SIDE_WIDTH
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: font.section,
    fontWeight: '700'
  }
});
