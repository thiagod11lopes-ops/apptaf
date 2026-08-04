import React from 'react';
import { Platform, Text, StyleSheet, type TextStyle } from 'react-native';
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
  if (Platform.OS === 'web') {
    return (
      <Text
        style={[
          styles.webLabel,
          {
            color,
            fontSize,
            fontWeight: fontWeight as TextStyle['fontWeight'],
            width: 70,
            height: 20,
            lineHeight: 20,
          },
        ]}
        numberOfLines={1}
      >
        Nip
      </Text>
    );
  }

  return (
    <Svg height={20} width={70} viewBox="0 0 70 20">
      <SvgText x="0" y="15" fill={color} fontSize={fontSize} fontWeight={fontWeight}>
        Nip
      </SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  webLabel: {
    includeFontPadding: false,
  },
});
