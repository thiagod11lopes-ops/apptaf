import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/** Tarja amarela opaca na diagonal, no centro do card do Histórico. */
export function HistoricoModoTesteStripe() {
  const { theme } = useTheme();

  return (
    <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        accessibilityLabel="Modo Teste"
        accessibilityRole="text"
        style={[
          styles.stripe,
          {
            backgroundColor: theme.isDark ? '#EAB308' : '#FACC15',
            borderColor: theme.isDark ? '#A16207' : '#CA8A04',
          },
        ]}
      >
        <Text style={styles.label} numberOfLines={1}>
          Modo Teste
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
  },
  stripe: {
    width: '130%',
    paddingVertical: 7,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-28deg' }],
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(66, 32, 6, 0.22)',
      } as object,
      default: {
        elevation: 3,
      },
    }),
  },
  label: {
    color: '#422006',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
});
