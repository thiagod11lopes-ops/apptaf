import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ContagemItem } from '../../utils/estatisticasTaf';
import { useTheme } from '../../contexts/ThemeContext';

type Props = {
  items: ContagemItem[];
  barColor?: string;
  maxItems?: number;
};

export function StatBarChart({ items, barColor, maxItems = 12 }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const fill = barColor ?? theme.primary;
  const slice = items.filter((i) => i.valor > 0).slice(0, maxItems);
  const max = Math.max(1, ...slice.map((i) => i.valor));

  if (slice.length === 0) {
    return <Text style={[ts.caption, styles.empty]}>Sem dados para exibir.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {slice.map((item) => {
        const pctBar = Math.round((item.valor / max) * 100);
        const pctLabel = item.pct != null ? `${item.pct}%` : '';
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={[ts.caption, { color: theme.text }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[ts.caption, { color: theme.text }]}>
                {item.valor}
                {pctLabel ? ` · ${pctLabel}` : ''}
              </Text>
            </View>
            <View style={[styles.barTrack, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={[styles.barFill, { width: `${pctBar}%`, backgroundColor: fill }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  row: { gap: 8 },
  labelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  empty: { fontStyle: 'italic' },
});
