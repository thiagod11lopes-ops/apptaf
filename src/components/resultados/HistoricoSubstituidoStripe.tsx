import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';

/** Tarja laranja opaca na diagonal — identifica resultado de histórico sem cobrir a leitura. */
export function HistoricoSubstituidoStripe() {
  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View accessibilityLabel="Histórico" accessibilityRole="text" style={styles.stripe}>
        <Text style={styles.label} numberOfLines={1}>
          Histórico
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 6,
    overflow: 'hidden',
    borderRadius: 12,
  },
  stripe: {
    width: '145%',
    paddingVertical: 8,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Opaco o suficiente para ler "Histórico", sem esconder o conteúdo por baixo.
    backgroundColor: 'rgba(249, 115, 22, 0.72)',
    borderColor: '#c2410c',
    transform: [{ rotate: '-28deg' }],
    ...Platform.select({
      web: {
        boxShadow: '0 2px 10px rgba(154, 52, 18, 0.35)',
      } as object,
      default: {
        elevation: 4,
      },
    }),
  },
  label: {
    color: '#fff7ed',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(67, 20, 7, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
