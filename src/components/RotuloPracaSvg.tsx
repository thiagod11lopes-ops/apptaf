import React from 'react';
import Svg, { Text } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';

/** Rótulo "Praça" em SVG para evitar autocorretor (ex.: Pç no Chrome). */
interface Props {
  /** Cor do texto (ex.: #FFF quando chip selecionado). */
  color?: string;
}
export function RotuloPracaSvg({ color }: Props) {
  const { theme } = useTheme();
  const fill = color ?? theme.text;
  return (
    <Svg width={44} height={20} viewBox="0 0 44 20">
      <Text
        x={2}
        y={15}
        fill={fill}
        fontSize={14}
        fontWeight="600"
        fontFamily="System"
      >
        Praça
      </Text>
    </Svg>
  );
}
