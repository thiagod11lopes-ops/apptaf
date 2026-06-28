import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, ClipboardList, Sparkles } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { getAplicarTafGlass } from './aplicarTafTheme';

type Props = {
  onIniciarTaf: () => void;
  onPreCadastro: () => void;
};

export function AplicarTafHomeLauncher({ onIniciarTaf, onPreCadastro }: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, { color: theme.primary }]}>MODO DE OPERAÇÃO</Text>
      <View style={styles.grid}>
        <TouchableOpacity
          accessibilityLabel="Iniciar TAF"
          activeOpacity={0.92}
          onPress={onIniciarTaf}
          style={[styles.tileWrap, Platform.OS === 'web' ? ({ boxShadow: '0 16px 40px rgba(37,99,235,0.28)' } as object) : null]}
        >
          <LinearGradient
            colors={[theme.primary, '#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tilePrimary}
          >
            <View style={styles.iconRing}>
              <Play size={28} color="#fff" strokeWidth={2.4} fill="#fff" />
            </View>
            <Text style={styles.tileTitlePrimary}>Iniciar TAF</Text>
            <Text style={styles.tileSubPrimary}>Prova ao vivo com cronômetro</Text>
            <Sparkles size={16} color="rgba(255,255,255,0.55)" style={styles.spark} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Pré Cadastro"
          activeOpacity={0.92}
          onPress={onPreCadastro}
          style={styles.tileWrap}
        >
          <View
            style={[
              styles.tileSecondary,
              {
                backgroundColor: glass.bg,
                borderColor: glass.border,
              },
            ]}
          >
            <View style={[styles.iconRingMuted, { backgroundColor: theme.isDark ? 'rgba(56,189,248,0.15)' : PREMIUM.accentMuted }]}>
              <ClipboardList size={26} color={theme.primary} strokeWidth={2.2} />
            </View>
            <Text style={[styles.tileTitle, { color: ui.text }]}>Pré Cadastro</Text>
            <Text style={[styles.tileSub, { color: theme.textSecondary }]}>
              Prepare participantes antes da prova
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginBottom: 8,
    gap: 10,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    paddingHorizontal: 2,
  },
  grid: {
    gap: 12,
  },
  tileWrap: {
    borderRadius: PREMIUM.radiusLg + 6,
    overflow: 'hidden',
  },
  tilePrimary: {
    padding: 20,
    minHeight: 132,
    justifyContent: 'flex-end',
    gap: 4,
    position: 'relative',
  },
  tileSecondary: {
    padding: 20,
    minHeight: 112,
    borderRadius: PREMIUM.radiusLg + 6,
    borderWidth: 1,
    gap: 4,
    justifyContent: 'flex-end',
  },
  iconRing: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRingMuted: {
    position: 'absolute',
    top: 18,
    left: 18,
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTitlePrimary: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tileSubPrimary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  tileTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginTop: 36,
  },
  tileSub: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  spark: {
    position: 'absolute',
    top: 22,
    right: 20,
  },
});
