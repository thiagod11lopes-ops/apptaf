import React from 'react';
import { View, Image, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from '../utils/rubricaConstants';

export { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from '../utils/rubricaConstants';

type Props = {
  svgUri?: string | null;
  /** Largura máxima; padrão = resolução nativa da captura. */
  maxWidth?: number;
  /** Altura máxima; padrão = resolução nativa da captura. */
  maxHeight?: number;
};

/** Exibe só a imagem da rúbrica, sem borda nem fundo, na maior definição possível. */
export function RubricaCell({
  svgUri,
  maxWidth = RUBRICA_NATIVA_LARGURA,
  maxHeight = RUBRICA_NATIVA_ALTURA,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const colMax = Math.min(maxWidth, Math.max(200, screenW * 0.42));

  if (!svgUri?.trim()) {
    return <Text style={styles.vazio}>—</Text>;
  }

  const ratio = maxHeight / maxWidth;
  const imgW = colMax;
  const imgH = Math.round(colMax * ratio);

  return (
    <View style={[styles.cell, { width: imgW, height: imgH }]}>
      <Image
        source={{ uri: svgUri }}
        style={{ width: imgW, height: imgH }}
        resizeMode="contain"
        accessibilityLabel="Rúbrica do candidato"
      />
    </View>
  );
}

/** @deprecated Use RubricaCell */
export const RubricaThumb = RubricaCell;

const styles = StyleSheet.create({
  cell: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  vazio: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
