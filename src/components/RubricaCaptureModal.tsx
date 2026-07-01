import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, Text, View, Platform } from 'react-native';
import { AppModal } from './premium/AppModal';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTheme } from '../contexts/ThemeContext';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { tituloTipoProva } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import {
  buildRubricaSvgDataUrl,
  buildStrokePath,
  type RubricaStroke,
} from '../utils/rubricaSvgBuilder';
import { RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
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
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const { theme } = useTheme();
  const [strokes, setStrokes] = useState<RubricaStroke[]>([]);
  const [strokeAtual, setStrokeAtual] = useState<RubricaStroke>([]);
  const [canvasWidth, setCanvasWidth] = useState(420);

  useEffect(() => {
    if (visible) {
      setStrokes([]);
      setStrokeAtual([]);
    }
  }, [visible, participante?.corredor, indice]);

  const iniciarStroke = useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = event.nativeEvent;
    setStrokeAtual([{ x: locationX, y: locationY }]);
  }, []);

  const moverStroke = useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = event.nativeEvent;
    setStrokeAtual((prev) => [...prev, { x: locationX, y: locationY }]);
  }, []);

  const finalizarStroke = useCallback(() => {
    if (strokeAtual.length === 0) return;
    setStrokes((prev) => [...prev, strokeAtual]);
    setStrokeAtual([]);
  }, [strokeAtual]);

  const limpar = useCallback(() => {
    setStrokes([]);
    setStrokeAtual([]);
  }, []);

  const confirmar = useCallback(() => {
    const todos: RubricaStroke[] = [
      ...strokes.filter((s) => s.length > 0),
      ...(strokeAtual.length > 0 ? [strokeAtual] : []),
    ];
    if (todos.length === 0) return;
    const svg = buildRubricaSvgDataUrl(todos, canvasWidth, RUBRICA_NATIVA_ALTURA);
    onConfirm(svg);
  }, [strokes, strokeAtual, canvasWidth, onConfirm]);

  if (!participante) return null;

  const mod = participante.prova ?? tipoProva;
  const modLabel = tituloTipoProva(mod);
  const temTraco = strokes.some((s) => s.length > 0) || strokeAtual.length > 0;
  const tempoStr = formatMsByModality(mod === 'natacao' ? 'natacao' : 'corrida', participante.tempoMs);

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
                onResponderRelease: finalizarStroke,
                onResponderTerminate: finalizarStroke,
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
              </Svg>
            </AssinaturaFuturistaCanvas>

            <AssinaturaFuturistaBtnRow>
              <AssinaturaFuturistaBtnGhost label="Limpar" onPress={limpar} />
              <AssinaturaFuturistaBtnGhost label="Cancelar" onPress={onCancel} flex />
              {Platform.OS === 'web' ? null : (
                <AssinaturaFuturistaBtnGhost label="Pular" onPress={onSkip} />
              )}
              <AssinaturaFuturistaBtnPrimary
                label={ultimo ? 'Salvar sessão' : 'Próximo'}
                onPress={confirmar}
                disabled={!temTraco}
                accent="cyan"
                flex
              />
            </AssinaturaFuturistaBtnRow>
            {Platform.OS === 'web' ? (
              <View style={{ marginTop: 8 }}>
                <TouchableOpacity onPress={onSkip} accessibilityLabel="Pular assinatura">
                  <Text style={{ color: theme.textMuted, fontWeight: '600', fontSize: 12, textAlign: 'center' }}>
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
