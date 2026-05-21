import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Variant = 'default' | 'gain' | 'loss' | 'muted';

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: TextStyle;
};

export function MonoValue({ children, variant = 'default', size = 'md', style }: Props) {
  const { theme } = useTheme();
  const color =
    variant === 'gain'
      ? theme.gain
      : variant === 'loss'
        ? theme.loss
        : variant === 'muted'
          ? theme.textMuted
          : theme.text;

  return (
    <Text
      style={[
        styles.mono,
        { color, fontFamily: theme.monoFont },
        size === 'sm' && styles.sm,
        size === 'lg' && styles.lg,
        size === 'xl' && styles.xl,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  mono: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  sm: { fontSize: 13 },
  lg: { fontSize: 22 },
  xl: { fontSize: 28, fontWeight: '700' },
});
