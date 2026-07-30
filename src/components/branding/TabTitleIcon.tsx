import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { tafIconeSource } from './brandAssets';

type Props = {
  size?: number;
};

/** Ícone TAF à esquerda dos títulos das abas. */
export function TabTitleIcon({ size = 36 }: Props) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]} accessibilityLabel="TAF">
      <Image source={tafIconeSource} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
