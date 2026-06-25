import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useDeviceLayout } from '../../hooks/useDeviceLayout';

type Props = {
  label: string;
  value: string | number;
  variant?: 'default' | 'positive' | 'negative' | 'primary' | 'warning';
};

export function StatCard({ label, value, variant = 'default' }: Props) {
  const { theme } = useTheme();
  const { usePhoneFrame, width } = useDeviceLayout();
  const compactGrid = usePhoneFrame || width < 420;
  const t = theme.tokens;
  const valueColor =
    variant === 'positive'
      ? theme.success
      : variant === 'negative'
        ? theme.error
        : variant === 'primary'
          ? theme.primary
          : variant === 'warning'
            ? t.warning500
            : theme.text;

  return (
    <View
      style={[
        styles.card,
        compactGrid ? styles.cardCompact : styles.cardRegular,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowCard } as object) : { elevation: 2 },
      ]}
    >
      <Text
        style={[styles.label, compactGrid && styles.labelCompact, { color: theme.textMuted }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <Text style={[styles.value, compactGrid && styles.valueCompact, { color: valueColor }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  cardRegular: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 180,
    padding: 16,
  },
  cardCompact: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 0,
    maxWidth: '48%',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  labelCompact: {
    fontSize: 9.5,
    letterSpacing: 0.35,
    lineHeight: 13,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 32,
  },
  valueCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
});
