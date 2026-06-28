import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../contexts/ThemeContext';
import { getUiColors } from '../../../theme/uiColors';
import { PREMIUM } from '../../../theme/premium';
import { AplicarTafPrimaryButton } from './AplicarTafUi';
import { getAplicarTafGlass } from './aplicarTafTheme';
import { useAplicarTafLayout } from './useAplicarTafLayout';

type Props = {
  titulo: string;
  meta: string;
  nomesPreview: string;
  onIniciar: () => void;
  onExcluir: () => void;
  accentColors: [string, string];
};

export function AplicarTafPreCadastroCard({
  titulo,
  meta,
  nomesPreview,
  onIniciar,
  onExcluir,
  accentColors,
}: Props) {
  const { theme } = useTheme();
  const ui = getUiColors(theme);
  const glass = getAplicarTafGlass(theme);
  const { isNativeMobile, isNarrowPhone } = useAplicarTafLayout();
  const stackActions = isNativeMobile || isNarrowPhone;

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
        <Text style={[styles.titulo, { color: ui.text }]}>{titulo}</Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{meta}</Text>
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
  titulo: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
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

export const PRE_CADASTRO_ACCENTS: Record<string, [string, string]> = {
  corrida: ['#2563eb', '#38bdf8'],
  natacao: ['#0891b2', '#6366f1'],
  permanencia: ['#7c3aed', '#4f46e5'],
  caminhada: ['#059669', '#14b8a6'],
};
