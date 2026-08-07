import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, Text, View, Platform, StyleSheet } from 'react-native';
import { AppModal } from './premium/AppModal';
import Svg, { Path as SvgPath, Text as SvgText } from 'react-native-svg';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { tituloTipoProva } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import {
  buildRubricaSvgDataUrl,
  buildStrokePath,
  RUBRICA_TEXTO_NO_IMPEDIMENTO,
} from '../utils/rubricaSvgBuilder';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
import { useRubricaStrokeDraw } from '../hooks/useRubricaStrokeDraw';
import { PressableScale } from './premium/PressableScale';
import {
  AssinaturaFuturistaOverlay,
  AssinaturaFuturistaScroll,
  AssinaturaFuturistaCard,
  AssinaturaFuturistaHeader,
  AssinaturaFuturistaMetaChip,
  AssinaturaFuturistaCanvas,
  AssinaturaFuturistaBtnRow,
  AssinaturaFuturistaBtnGhost,
  AssinaturaFuturistaBtnPrimary,
} from './assinatura/AssinaturaFuturistaUi';

type Props = {
  visible: boolean;
  participante: ResultadoCorridaItem | null;
  indice: number;
  total: number;
  tipoProva: TipoProvaAplicada;
  ultimo: boolean;
  /** Sobrescreve o texto do botão principal (padrão: Próximo / Salvar sessão). */
  confirmLabel?: string;
  /**
   * Exibe o botão “No Impedimento” (registrador / cadastro manual).
   * Marcado: grava “Rubrica do Aplicador” em diagonal na rúbrica.
   */
  habilitarNoImpedimento?: boolean;
  onConfirm: (svgDataUrl: string) => void;
  onSkip: () => void;
  onCancel: () => void;
};

export function RubricaCaptureModal({
  visible,
  participante,
  indice,
  total,
  tipoProva,
  ultimo,
  confirmLabel,
  habilitarNoImpedimento = false,
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const {
    strokes,
    strokeAtual,
    temTraco,
    iniciar,
    mover,
    finalizar,
    limpar,
    getTodosStrokes,
  } = useRubricaStrokeDraw();
  const [canvasWidth, setCanvasWidth] = useState(420);
  const [noImpedimento, setNoImpedimento] = useState(false);

  useEffect(() => {
    if (visible) {
      limpar();
      setNoImpedimento(false);
    }
  }, [visible, participante?.corredor, indice, limpar]);

  const iniciarStroke = useCallback(
    (event: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = event.nativeEvent;
      iniciar(locationX, locationY);
    },
    [iniciar],
  );

  const moverStroke = useCallback(
    (event: { nativeEvent: { locationX: number; locationY: number } }) => {
      const { locationX, locationY } = event.nativeEvent;
      mover(locationX, locationY);
    },
    [mover],
  );

  const confirmar = useCallback(() => {
    const todos = getTodosStrokes();
    if (todos.length === 0) return;
    const svg = buildRubricaSvgDataUrl(
      todos,
      canvasWidth,
      RUBRICA_NATIVA_ALTURA,
      RUBRICA_COR_TRACO,
      RUBRICA_COR_FUNDO,
      habilitarNoImpedimento && noImpedimento
        ? { textoTransversal: RUBRICA_TEXTO_NO_IMPEDIMENTO }
        : undefined,
    );
    onConfirm(svg);
  }, [
    canvasWidth,
    getTodosStrokes,
    habilitarNoImpedimento,
    noImpedimento,
    onConfirm,
  ]);

  if (!visible || !participante) return null;

  const mod = participante.prova ?? tipoProva;
  const modLabel = tituloTipoProva(mod);
  const tempoStr = formatMsByModality(
    mod === 'natacao' ? 'natacao' : 'corrida',
    participante.tempoMs,
  );
  const fontOverlay = Math.max(13, Math.round(Math.min(canvasWidth || 420, RUBRICA_NATIVA_ALTURA) * 0.13));

  const toggleNoImpedimento = habilitarNoImpedimento ? (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: noImpedimento }}
      accessibilityLabel="No Impedimento"
      accessibilityHint={
        noImpedimento
          ? 'Marcado: grava Rubrica do Aplicador em diagonal'
          : 'Marcar para registrar No Impedimento'
      }
      onPress={() => setNoImpedimento((v) => !v)}
      style={[
        styles.noImpBtn,
        {
          borderColor: noImpedimento ? theme.primary : theme.border,
          backgroundColor: noImpedimento
            ? theme.isDark
              ? 'rgba(37,99,235,0.28)'
              : 'rgba(37,99,235,0.12)'
            : theme.backgroundSecondary,
        },
      ]}
    >
      <ShieldCheck
        size={14}
        color={noImpedimento ? theme.primary : theme.textMuted}
        strokeWidth={2.4}
      />
      <Text
        style={[
          styles.noImpLabel,
          { color: noImpedimento ? theme.primary : theme.textSecondary },
        ]}
      >
        No Impedimento
      </Text>
    </PressableScale>
  ) : null;

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <AssinaturaFuturistaOverlay>
        <AssinaturaFuturistaScroll>
          <AssinaturaFuturistaCard accent="cyan">
            <AssinaturaFuturistaHeader
              kicker="CANDIDATO"
              title="Assinatura do candidato"
              subtitle={`Participante ${indice + 1} de ${total} · ${modLabel}`}
              accent="cyan"
              headerRight={toggleNoImpedimento}
            />

            <AssinaturaFuturistaMetaChip
              label="Militar"
              value={`${participante.nome || '—'}${participante.nip ? ` · NIP ${participante.nip}` : ''}`}
            />
            <AssinaturaFuturistaMetaChip
              label="Resultado"
              value={`Tempo ${tempoStr}${participante.notaTexto ? ` · Nota ${participante.notaTexto}` : ''}`}
            />

            <AssinaturaFuturistaCanvas
              accent="cyan"
              height={RUBRICA_NATIVA_ALTURA}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0) setCanvasWidth(w);
              }}
              canvasProps={{
                onStartShouldSetResponder: () => true,
                onMoveShouldSetResponder: () => true,
                onResponderGrant: iniciarStroke,
                onResponderMove: moverStroke,
                onResponderRelease: finalizar,
                onResponderTerminate: finalizar,
              }}
            >
              <Svg width="100%" height={RUBRICA_NATIVA_ALTURA}>
                {strokes.map((stroke, idx) => (
                  <SvgPath
                    key={`s-${idx}`}
                    d={buildStrokePath(stroke)}
                    stroke={RUBRICA_COR_TRACO}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {strokeAtual.length > 0 ? (
                  <SvgPath
                    d={buildStrokePath(strokeAtual)}
                    stroke={RUBRICA_COR_TRACO}
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {habilitarNoImpedimento && noImpedimento ? (
                  <SvgText
                    x="50%"
                    y="50%"
                    fill="rgba(17,24,39,0.42)"
                    fontSize={fontOverlay}
                    fontWeight="700"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(-28, ${(canvasWidth || 420) / 2}, ${RUBRICA_NATIVA_ALTURA / 2})`}
                  >
                    {RUBRICA_TEXTO_NO_IMPEDIMENTO}
                  </SvgText>
                ) : null}
              </Svg>
            </AssinaturaFuturistaCanvas>

            <AssinaturaFuturistaBtnRow>
              <AssinaturaFuturistaBtnGhost label="Limpar" onPress={limpar} />
              <AssinaturaFuturistaBtnGhost label="Cancelar" onPress={onCancel} flex />
              {Platform.OS === 'web' ? null : (
                <AssinaturaFuturistaBtnGhost label="Pular" onPress={onSkip} />
              )}
              <AssinaturaFuturistaBtnPrimary
                label={confirmLabel ?? (ultimo ? 'Salvar sessão' : 'Próximo')}
                onPress={confirmar}
                disabled={!temTraco}
                accent="cyan"
                flex
              />
            </AssinaturaFuturistaBtnRow>
            {Platform.OS === 'web' ? (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity onPress={onSkip} accessibilityLabel="Pular assinatura">
                  <Text
                    style={{
                      color: theme.textMuted,
                      fontWeight: '600',
                      fontSize: 12,
                      textAlign: 'center',
                    }}
                  >
                    Pular este participante
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </AssinaturaFuturistaCard>
        </AssinaturaFuturistaScroll>
      </AssinaturaFuturistaOverlay>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  noImpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: 148,
  },
  noImpLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
