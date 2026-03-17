import React from 'react';
import Svg, { Text } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

/** Label "NIP" em SVG para evitar autocorretor (ex.: Beliscar no Chrome). */
interface Props {
  /** Cor do texto (opcional). */
  color?: string;
}
export function LabelNip({ color }: Props) {
  const { theme } = useTheme();
  const fill = color ?? theme.text;
  return (
    <Svg width={32} height={20} viewBox="0 0 32 20">
      <Text
        x={2}
        y={15}
        fill={fill}
        fontSize={14}
        fontWeight="600"
        fontFamily="System"
      >
        NIP
      </Text>
    </Svg>
  );
}
