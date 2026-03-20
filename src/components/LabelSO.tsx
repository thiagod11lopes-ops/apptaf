import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

export function LabelSO({
  color,
  fontSize = 12,
  fontWeight = '900',
}: {
  color: string;
  fontSize?: number;
  fontWeight?: string | number;
}) {
  return (
    <Svg height={18} width={42} viewBox="0 0 42 18">
      <SvgText x="0" y="14" fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        SO
      </SvgText>
    </Svg>
  );
}

