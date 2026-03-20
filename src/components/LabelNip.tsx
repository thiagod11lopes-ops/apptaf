import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

export function LabelNip({ color }: { color: string }) {
  return (
    <Svg height={20} width={70} viewBox="0 0 70 20">
      <SvgText x="0" y="15" fill={color} fontSize={14} fontWeight="900">
        Nip
      </SvgText>
    </Svg>
  );
}

