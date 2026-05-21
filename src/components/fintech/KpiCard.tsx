import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { MonoValue } from './MonoValue';
import { Sparkline } from './Sparkline';
import { PREMIUM } from '../../theme/premium';

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
  const ts = theme.textStyles;
  const accentBg =
    variant === 'gain' ? theme.gainMuted : variant === 'loss' ? theme.lossMuted : theme.cardBg;
  const accentBorder =
    variant === 'gain' ? theme.gain : variant === 'loss' ? theme.loss : theme.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accentBg,
          borderColor: theme.border,
          borderLeftColor: accentBorder,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={[ts.label, { color: theme.text, textTransform: 'none', fontSize: 12 }]}>
          {label}
        </Text>
        {sparkData && sparkData.length > 1 ? (
          <Sparkline data={sparkData} variant={variant === 'default' ? 'neutral' : variant} />
        ) : null}
      </View>
      <MonoValue value={value} variant={variant} size="lg" />
      {hint ? (
        <Text style={[ts.caption, { color: theme.text }]} numberOfLines={2}>
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
    padding: 16,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    borderLeftWidth: 3,
    gap: 8,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
