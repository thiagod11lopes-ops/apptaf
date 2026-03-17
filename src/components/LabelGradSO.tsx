import React from 'react';
import Svg, { Text } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

/** Label "SO" (Suboficial) em SVG para evitar autocorretor (ex.: ENTÃO no Chrome). */
interface Props {
  /** Cor do texto (opcional). */
  color?: string;
}
export function LabelGradSO({ color }: Props) {
  const { theme } = useTheme();
  const fill = color ?? theme.text;
  return (
    <Svg width={24} height={20} viewBox="0 0 24 20">
      <Text
        x={2}
        y={15}
        fill={fill}
        fontSize={14}
        fontWeight="700"
        fontFamily="System"
      >
        SO
      </Text>
    </Svg>
  );
}
