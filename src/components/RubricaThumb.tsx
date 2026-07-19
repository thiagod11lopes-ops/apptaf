import React from 'react';
import { View, Image, Text, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { RUBRICA_NATIVA_ALTURA, RUBRICA_NATIVA_LARGURA } from '../utils/rubricaConstants';
import { normalizarRubricaSvgDataUrl } from '../utils/rubricaSvgNormalize';

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
  const colMax = Math.min(maxWidth, Math.max(120, Math.min(maxWidth, screenW * 0.42)));

  const uri = normalizarRubricaSvgDataUrl(svgUri);
  if (!uri) {
    return <Text style={styles.vazio}>—</Text>;
  }

  const ratio = maxHeight / Math.max(1, maxWidth);
  const imgW = colMax;
  const imgH = Math.max(1, Math.round(colMax * ratio));

  // RN Web Image frequentemente falha com data:image/svg+xml — usar <img> nativo.
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.cell, { width: imgW, height: imgH }]}>
        <img
          src={uri}
          alt="Rúbrica"
          width={imgW}
          height={imgH}
          style={{
            width: imgW,
            height: imgH,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.cell, { width: imgW, height: imgH }]}>
      <Image
        source={{ uri }}
        style={{ width: imgW, height: imgH }}
        resizeMode="contain"
        accessibilityLabel="Rúbrica"
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
