import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { FlashValue } from './FlashValue';
import { Sparkline } from './Sparkline';

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  variant?: 'default' | 'gain' | 'loss';
  sparkData?: number[];
  flashKey?: string | number;
};

export function KpiCard({ label, value, hint, variant = 'default', sparkData, flashKey }: Props) {
  const { theme } = useTheme();
  const accentBg =
    variant === 'gain' ? theme.gainMuted : variant === 'loss' ? theme.lossMuted : 'transparent';
  const accentBorder =
    variant === 'gain' ? theme.gain : variant === 'loss' ? theme.loss : theme.borderSubtle;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBg,
          borderColor: theme.borderSubtle,
          borderLeftColor: accentBorder,
        },
        accentBg !== 'transparent' && { backgroundColor: accentBg },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {sparkData && sparkData.length > 1 ? (
          <Sparkline
            data={sparkData}
            variant={variant === 'default' ? 'neutral' : variant}
          />
        ) : null}
      </View>
      <FlashValue value={value} variant={variant} size="lg" flashKey={flashKey ?? value} />
      {hint ? (
        <Text style={[styles.hint, { color: theme.textMuted }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 140,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    flex: 1,
  },
  hint: {
    fontSize: 11,
    lineHeight: 15,
  },
});
