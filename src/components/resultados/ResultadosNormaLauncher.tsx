import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ship, Anchor } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { PREMIUM } from '../../theme/premium';
import { TafGlassPanel } from '../mobile/TafTabChrome';

const NAVAL_CAMO_GRADIENT = ['#2a3320', '#4a5c38', '#5c4a32', '#3d4a28', '#6b5c45'] as const;
const NAVAL_CAMO_SHADOW = '0 16px 40px rgba(42,51,32,0.38)';

type Props = {
  onArmada: () => void;
  onCfn: () => void;
};

export function ResultadosNormaLauncher({ onArmada, onCfn }: Props) {
  const { theme } = useTheme();
  const ts = theme.textStyles;

  return (
    <TafGlassPanel accent="cyan" style={styles.wrap}>
      <Text style={[ts.body, { color: theme.textSecondary, textAlign: 'center', marginBottom: 14 }]}>
        Selecione qual conjunto de resultados deseja consultar.
      </Text>
      <View style={styles.grid}>
        <TouchableOpacity
          accessibilityLabel="Ver resultados TAF Armada"
          activeOpacity={0.92}
          onPress={onArmada}
          style={[styles.tileWrap, Platform.OS === 'web' ? ({ boxShadow: '0 16px 40px rgba(37,99,235,0.28)' } as object) : null]}
        >
          <LinearGradient
            colors={[theme.primary, '#6366f1', '#4f46e5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tilePrimary}
          >
            <View style={styles.tileBody}>
              <View style={styles.iconRing}>
                <Ship size={26} color="#fff" strokeWidth={2.4} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.tileTitlePrimary}>TAF Armada</Text>
                <Text style={styles.tileSubPrimary}>Corrida, caminhada, natação e permanência</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Ver resultados TAF CFN"
          activeOpacity={0.92}
          onPress={onCfn}
          style={[styles.tileWrap, Platform.OS === 'web' ? ({ boxShadow: NAVAL_CAMO_SHADOW } as object) : null]}
        >
          <LinearGradient
            colors={[...NAVAL_CAMO_GRADIENT]}
            locations={[0, 0.22, 0.48, 0.72, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileNaval}
          >
            <View style={styles.camoOverlay} pointerEvents="none" />
            <View style={styles.tileBody}>
              <View style={styles.iconRingNaval}>
                <Anchor size={24} color="#f0ebe0" strokeWidth={2.4} />
              </View>
              <View style={styles.textCol}>
                <Text style={styles.tileTitleNaval}>TAF CFN</Text>
                <Text style={styles.tileSubNaval}>Provas dos Fuzileiros Navais — CGCFN-108</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </TafGlassPanel>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
  },
  grid: {
    gap: 12,
  },
  tileWrap: {
    borderRadius: PREMIUM.radiusLg + 6,
    overflow: 'hidden',
  },
  tilePrimary: {
    padding: 18,
  },
  tileNaval: {
    padding: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  camoOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
    backgroundColor: 'transparent',
    borderTopWidth: 18,
    borderTopColor: 'rgba(26,34,21,0.55)',
    borderRightWidth: 28,
    borderRightColor: 'rgba(107,92,69,0.45)',
    borderBottomWidth: 22,
    borderBottomColor: 'rgba(45,58,31,0.5)',
    borderLeftWidth: 24,
    borderLeftColor: 'rgba(74,92,56,0.4)',
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconRing: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconRingNaval: {
    width: 50,
    height: 50,
    borderRadius: 15,
    backgroundColor: 'rgba(240,235,224,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(240,235,224,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  tileTitlePrimary: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tileSubPrimary: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  tileTitleNaval: {
    color: '#f0ebe0',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tileSubNaval: {
    color: 'rgba(240,235,224,0.78)',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
});
