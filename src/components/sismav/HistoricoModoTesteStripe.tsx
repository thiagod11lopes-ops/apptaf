import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

/** Tarja amarela vertical "Modo Teste" à direita do card do histórico. */
export function HistoricoModoTesteStripe() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel="Modo Teste"
      style={[
        styles.stripe,
        {
          backgroundColor: theme.isDark ? 'rgba(234, 179, 8, 0.92)' : '#FACC15',
          borderColor: theme.isDark ? '#CA8A04' : '#EAB308',
        },
      ]}
    >
      <Text style={styles.label} numberOfLines={1}>
        Modo Teste
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: {
    alignSelf: 'stretch',
    width: 28,
    minHeight: 56,
    marginVertical: -2,
    marginRight: -2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderLeftWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    color: '#422006',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    // Texto vertical (de cima para baixo).
    transform: [{ rotate: '90deg' }],
    width: 72,
    textAlign: 'center',
  },
});
