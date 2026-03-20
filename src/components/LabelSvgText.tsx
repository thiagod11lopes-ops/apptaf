import React from 'react';
import Svg, { Text as SvgText } from 'react-native-svg';

export function LabelSvgText({
  text,
  color,
  fontSize = 12,
  fontWeight = '800',
  width = 120,
  height = 18,
}: {
  text: string;
  color: string;
  fontSize?: number;
  fontWeight?: string | number;
  width?: number;
  height?: number;
}) {
  const y = Math.max(12, height - 4);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <SvgText x="0" y={y} fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        {text}
      </SvgText>
    </Svg>
  );
}

