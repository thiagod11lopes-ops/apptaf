import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  type GestureResponderEvent,
} from 'react-native';
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
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
import { PREMIUM } from '../theme/premium';

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

  const iniciarStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setStrokeAtual([{ x: locationX, y: locationY }]);
  }, []);

  const moverStroke = useCallback((event: GestureResponderEvent) => {
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>Rúbrica do candidato</Text>
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            Participante {indice + 1} de {total} · {modLabel}
          </Text>
          <Text style={[styles.linha, { color: theme.text }]}>
            <Text style={styles.strong}>{participante.nome || '—'}</Text>
            {participante.nip ? ` · NIP ${participante.nip}` : ''}
          </Text>
          <Text style={[styles.linha, { color: theme.textMuted }]}>
            Tempo: {formatMsByModality(mod === 'natacao' ? 'natacao' : 'corrida', participante.tempoMs)}
            {participante.notaTexto ? ` · Nota ${participante.notaTexto}` : ''}
          </Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Desenhe a assinatura abaixo. Será gravada na modalidade {modLabel} do cadastro.
          </Text>

          <View
            style={[styles.canvasWrap, { borderColor: theme.border, backgroundColor: RUBRICA_COR_FUNDO }]}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0) setCanvasWidth(w);
            }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={iniciarStroke}
            onResponderMove={moverStroke}
            onResponderRelease={finalizarStroke}
            onResponderTerminate={finalizarStroke}
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
          </View>

          <TouchableOpacity onPress={limpar} style={[styles.btnSec, { borderColor: theme.border }]}>
            <Text style={{ color: theme.text, fontWeight: '700' }}>Limpar</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <TouchableOpacity onPress={onCancel} style={[styles.btnGhost, { borderColor: theme.border }]}>
              <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onSkip} style={[styles.btnGhost, { borderColor: theme.border }]}>
              <Text style={{ color: theme.textMuted, fontWeight: '600', fontSize: 12 }}>Pular</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmar}
              disabled={!temTraco}
              style={[
                styles.btnPrimary,
                { backgroundColor: theme.primary, opacity: temTraco ? 1 : 0.45 },
              ]}
            >
              <Text style={styles.btnPrimaryText}>{ultimo ? 'Salvar sessão' : 'Próximo'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    padding: 18,
  },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sub: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  linha: { fontSize: 14, marginBottom: 4 },
  strong: { fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  canvasWrap: {
    width: '100%',
    height: RUBRICA_NATIVA_ALTURA,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  btnSec: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    marginBottom: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  btnGhost: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 1,
    minWidth: 120,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
