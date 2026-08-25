import React from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Pencil } from 'lucide-react-native';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { AplicarTafPrimaryButton } from './AplicarTafUi';
import { getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';

type Props = {
  /** Número de ordem do card (1-based), exibido no topo à direita. */
  numero: number;
  /** Nome de código (Alfa…Zulu); opcional. */
  titulo?: string | null;
  /** Nome da modalidade (Natação, Corrida…), colorido. */
  modalidadeLabel: string;
  meta: string;
  nomesPreview: string;
  onIniciar: () => void;
  onExcluir: () => void;
  onEditar: () => void;
  accentColors: [string, string];
};

export function AplicarTafPreCadastroCard({
  numero,
  titulo,
  modalidadeLabel,
  meta,
  nomesPreview,
  onIniciar,
  onExcluir,
  onEditar,
  accentColors,
}: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const { isNativeMobile, isNarrowPhone } = useAplicarTafLayout();
  const stackActions = isNativeMobile || isNarrowPhone;
  const numLabel = String(Math.max(1, Math.floor(numero)));
  const nomeCard = (titulo || '').trim();
  const modalidadeColor = accentColors[0];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: glass.bg,
          borderColor: glass.border,
        },
        Platform.OS === 'web' ? ({ boxShadow: '0 6px 20px rgba(15,23,42,0.06)' } as object) : null,
      ]}
    >
      <LinearGradient colors={accentColors} style={styles.stripe} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <View style={styles.titleRow}>
              {nomeCard ? (
                <Text style={[styles.titulo, { color: ui.text }]} numberOfLines={1}>
                  {nomeCard}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.modalidade,
                  {
                    color: modalidadeColor,
                    backgroundColor: theme.isDark
                      ? `${modalidadeColor}33`
                      : `${modalidadeColor}18`,
                  },
                ]}
                numberOfLines={1}
              >
                {modalidadeLabel}
              </Text>
            </View>
            <Text style={[styles.meta, { color: theme.textSecondary }]}>{meta}</Text>
          </View>
          <View style={styles.orbArea}>
            <TouchableOpacity
              onPress={onEditar}
              style={styles.editBtn}
              accessibilityLabel={`Editar pré-cadastro número ${numLabel}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
            >
              <Pencil size={17} color={accentColors[0]} strokeWidth={2.3} />
            </TouchableOpacity>
            <View
              style={[
                styles.numeroOrb,
                Platform.OS === 'web'
                  ? ({
                      boxShadow: `0 8px 22px ${accentColors[0]}55, 0 0 0 1px ${accentColors[1]}44`,
                    } as object)
                  : {
                      shadowColor: accentColors[0],
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 12,
                      elevation: 6,
                    },
              ]}
              accessibilityLabel={`Pré-cadastro número ${numLabel}`}
            >
              <LinearGradient
                colors={[...accentColors]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.numeroOrbFill}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.06)', 'transparent']}
                  start={{ x: 0.2, y: 0 }}
                  end={{ x: 0.9, y: 1 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Text style={styles.numeroText} numberOfLines={1}>
                  {numLabel}
                </Text>
              </LinearGradient>
            </View>
          </View>
        </View>
        <Text style={[styles.nomes, { color: theme.textMuted }]} numberOfLines={2}>
          {nomesPreview}
        </Text>
        <View style={[styles.actions, stackActions ? styles.actionsStacked : null]}>
          <View style={styles.btnIniciarWrap}>
            <AplicarTafPrimaryButton label="Iniciar Prova" onPress={onIniciar} />
          </View>
          <View style={[styles.btnExcluirWrap, stackActions ? styles.btnExcluirStacked : null]}>
            <AplicarTafPrimaryButton label="Excluir" onPress={onExcluir} variant="outline" />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusLg,
    overflow: 'hidden',
    marginBottom: 10,
  },
  stripe: {
    height: 3,
    width: '100%',
  },
  body: {
    padding: 14,
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 4,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  orbArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroOrb: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  numeroOrbFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    overflow: 'hidden',
  },
  numeroText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    textShadowColor: 'rgba(15, 23, 42, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titulo: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  modalidade: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
    maxWidth: '100%',
  },
  meta: {
    fontSize: 12,
    fontWeight: '700',
  },
  nomes: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    marginBottom: 6,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  actionsStacked: {
    flexDirection: 'column',
  },
  btnIniciarWrap: {
    flex: 1,
    minWidth: 0,
  },
  btnExcluirWrap: {
    width: 96,
    flexShrink: 0,
  },
  btnExcluirStacked: {
    width: '100%',
  },
});

/** Cores distintas por modalidade (stripe, badge e orb). */
export const PRE_CADASTRO_ACCENTS: Record<string, [string, string]> = {
  corrida: ['#2563eb', '#38bdf8'],
  natacao: ['#0891b2', '#06b6d4'],
  permanencia: ['#7c3aed', '#a78bfa'],
  caminhada: ['#059669', '#14b8a6'],
  flexao_barra: ['#b45309', '#d97706'],
  flexao_solo: ['#c2410c', '#ea580c'],
  abdominal_remador: ['#4d7c0f', '#65a30d'],
  abdominal_prancha: ['#0f766e', '#14b8a6'],
};
