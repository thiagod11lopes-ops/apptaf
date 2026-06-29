import React, { useMemo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

const logoMb = require('../../../Logomb.png');

/** Margem mínima entre a logo e as bordas úteis da área. */
const EDGE_INSET = 12;

type Props = {
  /** Opacidade da marca d'água (0–1). */
  opacity?: number;
  /** Multiplicador de tamanho em relação ao maior quadrado que cabe na área. */
  sizeMultiplier?: number;
  /** Largura da área pai (preferível ao useWindowDimensions). */
  containerWidth?: number;
  /** Altura da área pai (preferível ao useWindowDimensions). */
  containerHeight?: number;
};

/** Logo MB centralizada ao fundo, ocupando o máximo de área sem encostar nas bordas. */
export function LogombWatermark({
  opacity,
  sizeMultiplier = 2,
  containerWidth,
  containerHeight,
}: Props) {
  const window = useWindowDimensions();
  const { theme } = useTheme();

  const width = containerWidth ?? window.width;
  const height = containerHeight ?? window.height;

  const logoOpacity = opacity ?? (theme.isDark ? 0.2 : 0.16);

  const logoSize = useMemo(() => {
    const availW = Math.max(0, width - EDGE_INSET * 2);
    const availH = Math.max(0, height - EDGE_INSET * 2);
    const base = Math.min(availW, availH);
    return Math.min(base * sizeMultiplier, availW, availH);
  }, [height, sizeMultiplier, width]);

  if (logoSize <= 0) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image
        source={logoMb}
        style={{
          width: logoSize,
          height: logoSize,
          opacity: logoOpacity,
        }}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
});
