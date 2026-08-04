import React from 'react';
import { Platform, Text, StyleSheet, type TextStyle } from 'react-native';
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
  // Web: Text nativo — SVG por célula/cabeçalho era custo alto na planilha.
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          styles.webLabel,
          {
            color,
            fontSize,
            fontWeight: String(fontWeight) as TextStyle['fontWeight'],
            width,
            height,
            lineHeight: height,
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    );
  }

  const y = Math.max(12, height - 4);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <SvgText x="0" y={y} fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        {text}
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  webLabel: {
    includeFontPadding: false,
  },
});
