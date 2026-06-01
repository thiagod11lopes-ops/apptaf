import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RubricaCell } from './RubricaThumb';

type Props = {
  titulo: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  rubricaSvg?: string | null;
};

/** Bloco de prova com coluna dedicada "Rúbrica" ao lado dos dados. */
export function ProvaComColunaRubrica({ titulo, headerRight, children, rubricaSvg }: Props) {
  const { theme } = useTheme();

  return (
    <View style={[styles.block, { borderTopColor: theme.borderSubtle }]}>
      <View style={styles.header}>
        <Text style={[styles.titulo, { color: theme.textSecondary }]}>{titulo}</Text>
        {headerRight}
      </View>
      <View style={styles.grid}>
        <View style={styles.dadosCol}>{children}</View>
        <View style={styles.rubricaCol}>
          <Text style={[styles.rubricaLabel, { color: theme.textMuted }]}>Rúbrica</Text>
          <RubricaCell svgUri={rubricaSvg} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titulo: {
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dadosCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rubricaCol: {
    width: '42%',
    maxWidth: 440,
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  rubricaLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.55,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
});
