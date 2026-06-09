import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { tableFullWidthStyle } from '../../theme/tableLayout';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  width?: number | string;
  render: (row: T, index: number) => React.ReactNode;
};

type Props<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
};

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'Nenhum registro encontrado.',
}: Props<T>) {
  const { theme } = useTheme();
  const t = theme.tokens;

  if (data.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: theme.border }]}>
        <Text style={{ color: theme.textMuted, textAlign: 'center' }}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrapper,
        { borderColor: theme.border, backgroundColor: theme.surface },
        Platform.OS === 'web' ? ({ boxShadow: t.shadowSm } as object) : undefined,
      ]}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator style={styles.scroll}>
        <View style={styles.tableInner}>
          <View style={[styles.headRow, { backgroundColor: theme.backgroundSecondary }]}>
            {columns.map((col) => (
              <View key={col.key} style={[styles.cell, col.width ? { width: col.width as number } : styles.cellFlex]}>
                <Text style={[styles.headText, { color: theme.textMuted }]}>{col.header}</Text>
              </View>
            ))}
          </View>
          {data.map((row, index) => (
            <View
              key={keyExtractor(row, index)}
              style={[styles.bodyRow, { borderTopColor: theme.border }]}
            >
              {columns.map((col) => (
                <View key={col.key} style={[styles.cell, col.width ? { width: col.width as number } : styles.cellFlex]}>
                  {col.render(row, index)}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...tableFullWidthStyle,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scroll: {
    width: '100%',
    maxWidth: '100%',
  },
  tableInner: {
    width: '100%',
    minWidth: '100%',
  },
  headRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bodyRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    paddingHorizontal: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  cellFlex: {
    flex: 1,
    minWidth: 120,
  },
  headText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
