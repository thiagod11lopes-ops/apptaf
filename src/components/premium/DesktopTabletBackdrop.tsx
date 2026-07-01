import React from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const corridaBg = require('../../../Corrida.png');
const natacaoBg = require('../../../Natacao.png');

/** Fundo desktop atrás da moldura do tablet — Corrida + Natação em tela cheia. */
export function DesktopTabletBackdrop() {
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.halfLeft}>
        <Image source={corridaBg} style={styles.fullCover} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <View style={styles.halfRight}>
        <Image source={natacaoBg} style={styles.fullCover} resizeMode="cover" accessibilityIgnoresInvertColors />
      </View>
      <LinearGradient
        colors={['rgba(7,7,13,0.18)', 'rgba(7,7,13,0.42)', 'rgba(7,7,13,0.55)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(7,7,13,0.35)', 'transparent', 'rgba(7,7,13,0.35)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    backgroundColor: '#07070d',
  },
  halfLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '50%',
    overflow: 'hidden',
  },
  halfRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '50%',
    overflow: 'hidden',
  },
  fullCover: {
    width: '100%',
    height: '100%',
    ...Platform.select({
      web: { objectFit: 'cover' } as object,
      default: {},
    }),
  },
});
