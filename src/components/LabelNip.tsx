import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

export function LabelNip({
  color,
  fontSize = 14,
  fontWeight = '900',
}: {
  color: string;
  fontSize?: number;
  fontWeight?: string;
}) {
  return (
    <Svg height={20} width={70} viewBox="0 0 70 20">
      <SvgText x="0" y="15" fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        Nip
      </SvgText>
    </Svg>
  );
}

