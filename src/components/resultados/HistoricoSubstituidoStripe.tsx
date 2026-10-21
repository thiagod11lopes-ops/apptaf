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
      <View
        accessibilityLabel="Histórico"
        accessibilityRole="text"
        style={styles.stripe}
      >
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
    zIndex: 4,
    overflow: 'hidden',
    borderRadius: 12,
  },
  stripe: {
    width: '140%',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(234, 88, 12, 0.55)',
    borderColor: 'rgba(154, 52, 18, 0.75)',
    transform: [{ rotate: '-28deg' }],
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(154, 52, 18, 0.28)',
      } as object,
      default: {
        elevation: 2,
      },
    }),
  },
  label: {
    color: '#fff7ed',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(67, 20, 7, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
