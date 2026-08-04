import React from 'react';
import { Platform, Text, StyleSheet, type TextStyle } from 'react-native';
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
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          styles.webLabel,
          {
            color,
            fontSize,
            fontWeight: String(fontWeight) as TextStyle['fontWeight'],
            width: 42,
            height: 18,
            lineHeight: 18,
          },
        ]}
        numberOfLines={1}
      >
        SO
      </Text>
    );
  }

  return (
    <Svg height={18} width={42} viewBox="0 0 42 18">
      <SvgText x="0" y="14" fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        SO
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  webLabel: {
    includeFontPadding: false,
  },
});
