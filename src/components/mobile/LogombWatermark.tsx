import React, { useMemo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

const logoMb = require('../../../Logomb.png');

/** Margem mínima entre a logo e as bordas úteis da tela. */
const EDGE_INSET = 12;

type Props = {
  /** Opacidade da marca d'água (0–1). */
  opacity?: number;
  /** Multiplicador de tamanho em relação ao maior quadrado que cabe na tela. */
  sizeMultiplier?: number;
};

/** Logo MB centralizada ao fundo, ocupando o máximo de área sem encostar nas bordas. */
export function LogombWatermark({ opacity, sizeMultiplier = 2 }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const logoOpacity = opacity ?? (theme.isDark ? 0.13 : 0.1);

  const logoSize = useMemo(() => {
    const availW = Math.max(0, width - insets.left - insets.right - EDGE_INSET * 2);
    const availH = Math.max(0, height - insets.top - insets.bottom - EDGE_INSET * 2);
    const base = Math.min(availW, availH);
    return base * sizeMultiplier;
  }, [height, insets.bottom, insets.left, insets.right, insets.top, sizeMultiplier, width]);

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
    zIndex: 0,
    overflow: 'hidden',
  },
});
