import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ContagemItem } from '../../utils/estatisticasTaf';

type Props = {
  items: ContagemItem[];
  barColor?: string;
  textColor: string;
  mutedColor: string;
  maxItems?: number;
};

export function StatBarChart({
  items,
  barColor = '#15803D',
  textColor,
  mutedColor,
  maxItems = 12,
}: Props) {
  const slice = items.filter((i) => i.valor > 0).slice(0, maxItems);
  const max = Math.max(1, ...slice.map((i) => i.valor));

  if (slice.length === 0) {
    return <Text style={[styles.empty, { color: mutedColor }]}>Sem dados para exibir.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {slice.map((item) => {
        const pctBar = Math.round((item.valor / max) * 100);
        const pctLabel = item.pct != null ? `${item.pct}%` : '';
        return (
          <View key={item.label} style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.count, { color: mutedColor }]}>
                {item.valor}
                {pctLabel ? ` · ${pctLabel}` : ''}
              </Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${pctBar}%`, backgroundColor: barColor },
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
  wrap: { gap: 10 },
  row: { gap: 4 },
  labelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: { flex: 1, fontSize: 13, fontWeight: '600' },
  count: { fontSize: 12 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  empty: { fontSize: 13, fontStyle: 'italic' },
});
