import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ContagemItem } from '../../utils/estatisticasTaf';
import { useTheme } from '../../contexts/ThemeContext';
import { MonoValue } from '../fintech/MonoValue';
import { FINTECH } from '../../theme/fintech';

type Props = {
  items: ContagemItem[];
  barColor?: string;
  maxItems?: number;
};

export function StatBarChart({ items, barColor, maxItems = 12 }: Props) {
  const { theme } = useTheme();
  const fill = barColor ?? theme.primary;
  const slice = items.filter((i) => i.valor > 0).slice(0, maxItems);
  const max = Math.max(1, ...slice.map((i) => i.valor));

  if (slice.length === 0) {
    return <Text style={[styles.empty, { color: theme.textMuted }]}>Sem dados para exibir.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {slice.map((item) => {
        const pctBar = Math.round((item.valor / max) * 100);
        const pctLabel = item.pct != null ? `${item.pct}%` : '';
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <MonoValue size="sm" variant="muted">
                {item.valor}
                {pctLabel ? ` · ${pctLabel}` : ''}
              </MonoValue>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.backgroundSecondary }]}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pctBar}%`, backgroundColor: fill },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  row: { gap: 6 },
  labelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: { flex: 1, fontSize: 13, fontWeight: '600' },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3, minWidth: 3 },
  empty: { fontSize: 13, fontStyle: 'italic' },
});
