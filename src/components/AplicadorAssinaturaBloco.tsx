import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { RubricaCell } from './RubricaThumb';
import { postoGradExibicaoAssinatura, type AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';

type Props = {
  assinatura: AplicadorAssinaturaResumo;
};

/** Assinatura do aplicador: rúbrica (se houver), linha e identificação. */
export function AplicadorAssinaturaBloco({ assinatura }: Props) {
  const { theme } = useTheme();
  const postoGrad = postoGradExibicaoAssinatura(assinatura);

  return (
    <View style={styles.wrap}>
      {assinatura.rubricaSvg ? (
        <View style={styles.rubricaWrap}>
          <RubricaCell svgUri={assinatura.rubricaSvg} maxWidth={320} maxHeight={140} />
        </View>
      ) : null}
      <View style={[styles.linha, { backgroundColor: theme.border }]} />
      <View style={styles.identificacao}>
        <Text style={[styles.postoGrad, { color: theme.textSecondary }]}>{postoGrad}</Text>
        <Text style={[styles.nome, { color: theme.text }]}>{assinatura.nome}</Text>
      </View>
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
  rubricaWrap: {
    marginBottom: 12,
    alignItems: 'center',
  },
  linha: {
    width: '72%',
    maxWidth: 420,
    height: 1,
    marginBottom: 14,
  },
  identificacao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
    maxWidth: '92%',
  },
  postoGrad: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  nome: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'left',
  },
  nip: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
