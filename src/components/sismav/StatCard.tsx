import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  label: string;
  value: string | number;
  variant?: 'default' | 'positive' | 'negative';
};

export function StatCard({ label, value, variant = 'default' }: Props) {
  const { theme } = useTheme();
  const t = theme.tokens;
  const valueColor =
    variant === 'positive' ? theme.success : variant === 'negative' ? theme.error : theme.text;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowCard } as object) : { elevation: 2 },
      ]}
    >
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 180,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
});
