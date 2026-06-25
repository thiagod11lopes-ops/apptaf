import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RubricaCell } from './RubricaThumb';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';

type Props = {
  assinatura: AplicadorAssinaturaResumo;
};

/** Rúbrica do aplicador centralizada, linha e dados abaixo (categoria, nome, NIP). */
export function AplicadorAssinaturaBloco({ assinatura }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.rubricaCenter}>
        <RubricaCell svgUri={assinatura.rubricaSvg} maxWidth={280} maxHeight={120} />
      </View>
      <View style={[styles.linha, { backgroundColor: theme.border }]} />
      <Text style={[styles.categoria, { color: theme.textSecondary }]}>{assinatura.categoria}</Text>
      <Text style={[styles.nome, { color: theme.text }]}>{assinatura.nome}</Text>
      <Text style={[styles.nip, { color: theme.textMuted }]}>NIP {assinatura.nip || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 28,
    paddingTop: 8,
    paddingBottom: 8,
  },
  rubricaCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  linha: {
    width: '72%',
    maxWidth: 420,
    height: 1,
    marginBottom: 14,
  },
  categoria: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
    textAlign: 'center',
  },
  nome: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  nip: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
