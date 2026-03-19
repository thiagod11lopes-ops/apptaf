import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

export function LabelNip({ color }: { color: string }) {
  return (
    <Svg height={28} width={110} viewBox="0 0 110 28">
      {/* Aproxima o textShadow do Menu (offset 2px + sombra). */}
      <SvgText x="0" y="20" fill="rgba(0,0,0,0.9)" fontSize={18} fontWeight="800">
        Nip
      </SvgText>
      <SvgText x="0" y="21" fill="rgba(0,0,0,0.95)" fontSize={18} fontWeight="800">
        Nip
      </SvgText>
      <SvgText x="0" y="19" fill={color} fontSize={18} fontWeight="800">
        Nip
      </SvgText>
    </Svg>
  );
}

