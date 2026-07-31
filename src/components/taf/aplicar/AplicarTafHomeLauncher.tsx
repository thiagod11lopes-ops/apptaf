import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ship, ClipboardList, Sparkles, Anchor, ShieldAlert, Ban } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';

/** Verde-oliva, cáqui e marrom — inspirado na farda camuflada dos Fuzileiros Navais. */
const NAVAL_CAMO_GRADIENT = ['#2a3320', '#4a5c38', '#5c4a32', '#3d4a28', '#6b5c45'] as const;
const NAVAL_CAMO_SHADOW = '0 16px 40px rgba(42,51,32,0.38)';

type Props = {
  onIniciarTaf: () => void;
  onIniciarTafNaval: () => void;
  onPreCadastro: () => void;
  onFatoresRisco: () => void;
  onRestritos: () => void;
  /** Quantidade de pré-cadastros já salvos. */
  preCadastrosCount?: number;
};

function textoPreCadastrosCount(n: number): string {
  if (n === 1) return '1 Prova Cadastrada';
  return `${n} Provas Cadastradas`;
}

export function AplicarTafHomeLauncher({
  onIniciarTaf,
  onIniciarTafNaval,
  onPreCadastro,
  onFatoresRisco,
  onRestritos,
  preCadastrosCount = 0,
}: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const { isNarrowPhone } = useAplicarTafLayout();
  const preCadastroLabel = textoPreCadastrosCount(Math.max(0, Math.floor(preCadastrosCount)));

  return (
    <View style={styles.wrap}>
      <View style={styles.grid}>
        <TouchableOpacity
          accessibilityLabel="Iniciar TAF Armada"
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
            <View style={styles.tileBody}>
              <View style={styles.iconRing}>
                <Ship size={26} color="#fff" strokeWidth={2.4} />
              </View>
              <View style={styles.textCol}>
                <Text style={[styles.tileTitlePrimary, isNarrowPhone ? styles.tileTitleCompact : null]}>
                  Iniciar TAF Armada
                </Text>
              </View>
              <Sparkles size={18} color="rgba(255,255,255,0.5)" style={styles.spark} />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Iniciar TAF CFN"
          activeOpacity={0.92}
          onPress={onIniciarTafNaval}
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
                <Text style={[styles.tileTitleNaval, isNarrowPhone ? styles.tileTitleCompact : null]}>
                  Iniciar TAF CFN
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel={`Pré Cadastro. ${preCadastroLabel}`}
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
            <View style={styles.tileBody}>
              <View
                style={[
                  styles.iconRingMuted,
                  { backgroundColor: theme.isDark ? 'rgba(56,189,248,0.15)' : PREMIUM.accentMuted },
                ]}
              >
                <ClipboardList size={24} color={theme.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.textCol}>
                <View style={styles.preCadastroTitleRow}>
                  <Text
                    style={[
                      styles.tileTitle,
                      { color: ui.text },
                      isNarrowPhone ? styles.tileTitleCompact : null,
                      styles.preCadastroTitle,
                    ]}
                    numberOfLines={1}
                  >
                    Pré Cadastro
                  </Text>
                  <View
                    style={[
                      styles.preCadastroBadge,
                      {
                        borderColor: theme.isDark
                          ? 'rgba(56,189,248,0.4)'
                          : 'rgba(37,99,235,0.28)',
                        backgroundColor: theme.isDark
                          ? 'rgba(56,189,248,0.14)'
                          : 'rgba(37,99,235,0.1)',
                      },
                    ]}
                  >
                    <Text
                      style={[styles.preCadastroBadgeText, { color: theme.primary }]}
                      numberOfLines={1}
                    >
                      {preCadastroLabel}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.tileSub, { color: theme.textSecondary }]}>
                  Prepare participantes antes da prova
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Fatores de Risco"
          activeOpacity={0.92}
          onPress={onFatoresRisco}
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
            <View style={styles.tileBody}>
              <View
                style={[
                  styles.iconRingMuted,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(245,158,11,0.18)'
                      : 'rgba(245,158,11,0.14)',
                  },
                ]}
              >
                <ShieldAlert size={24} color="#d97706" strokeWidth={2.2} />
              </View>
              <View style={styles.textCol}>
                <Text
                  style={[styles.tileTitle, { color: ui.text }, isNarrowPhone ? styles.tileTitleCompact : null]}
                >
                  Fatores de Risco
                </Text>
                <Text style={[styles.tileSub, { color: theme.textSecondary }]}>
                  Avalie condições de saúde antes da prova
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Restritos"
          activeOpacity={0.92}
          onPress={onRestritos}
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
            <View style={styles.tileBody}>
              <View
                style={[
                  styles.iconRingMuted,
                  {
                    backgroundColor: theme.isDark
                      ? 'rgba(148,163,184,0.2)'
                      : 'rgba(100,116,139,0.14)',
                  },
                ]}
              >
                <Ban size={24} color={theme.isDark ? '#94a3b8' : '#64748b'} strokeWidth={2.2} />
              </View>
              <View style={styles.textCol}>
                <Text
                  style={[styles.tileTitle, { color: ui.text }, isNarrowPhone ? styles.tileTitleCompact : null]}
                >
                  Restritos
                </Text>
                <Text style={[styles.tileSub, { color: theme.textSecondary }]}>
                  Registre dispensas com início e fim
                </Text>
              </View>
            </View>
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
  tileTitleNaval: {
    color: '#f0ebe0',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tileSecondary: {
    padding: 18,
    borderRadius: PREMIUM.radiusLg + 6,
    borderWidth: 1,
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
  iconRingMuted: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  preCadastroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  preCadastroTitle: {
    flexShrink: 1,
  },
  preCadastroBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 0,
  },
  preCadastroBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  tileTitlePrimary: {
    color: '#fff',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  tileTitleCompact: {
    fontSize: 19,
  },
  tileTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  tileSub: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  spark: {
    flexShrink: 0,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
});
