import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllAplicadores } from '../../services/aplicadoresIndexedDb';
import { encontrarAplicadorPorSenha } from '../../utils/aplicadorSenha';
import { buildRubricaSvgDataUrl } from '../../utils/rubricaSvgBuilder';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../../utils/rubricaSvgNormalize';
import {
  postoGradAplicador,
  type AplicadorAssinaturaResumo,
} from '../../types/aplicadorAssinatura';

const RUBRICA_CANVAS_HEIGHT = 180;

type RubricaPoint = { x: number; y: number };
type RubricaStroke = RubricaPoint[];

function buildStrokePath(points: RubricaPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return `M ${first.x} ${first.y} ${rest.map((p) => `L ${p.x} ${p.y}`).join(' ')}`;
}

type Props = {
  visible: boolean;
  onConcluir: (assinatura: AplicadorAssinaturaResumo) => void;
};

export function FluxoAssinaturaAplicadorModal({ visible, onConcluir }: Props) {
  const { theme } = useTheme();
  const [etapa, setEtapa] = useState<'senha' | 'rubrica'>('senha');
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [aplicadorId, setAplicadorId] = useState<string | null>(null);
  const [aplicadorNome, setAplicadorNome] = useState('');
  const [aplicadorNip, setAplicadorNip] = useState('');
  const [aplicadorCategoria, setAplicadorCategoria] = useState<'Oficiais' | 'Praças'>('Oficiais');
  const [aplicadorPostoGrad, setAplicadorPostoGrad] = useState('');
  const [rubricaStrokes, setRubricaStrokes] = useState<RubricaStroke[]>([]);
  const [rubricaStrokeAtual, setRubricaStrokeAtual] = useState<RubricaStroke>([]);
  const [rubricaCanvasWidth, setRubricaCanvasWidth] = useState(420);
  const [erroRubrica, setErroRubrica] = useState('');

  useEffect(() => {
    if (!visible) return;
    setEtapa('senha');
    setSenha('');
    setErroSenha('');
    setVerificando(false);
    setAplicadorId(null);
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErroRubrica('');
  }, [visible]);

  const confirmarSenha = useCallback(async () => {
    if (!senha.trim()) {
      setErroSenha('Informe a senha do aplicador.');
      return;
    }
    setVerificando(true);
    setErroSenha('');
    try {
      const lista = await getAllAplicadores();
      const comSenha = lista.filter((a) => a.senhaHash);
      if (comSenha.length === 0) {
        setErroSenha('Nenhum aplicador com senha cadastrada. Cadastre no menu Aplicador.');
        return;
      }
      const encontrado = await encontrarAplicadorPorSenha(senha, comSenha);
      if (!encontrado) {
        setErroSenha('Senha incorreta.');
        return;
      }
      setAplicadorId(encontrado.id);
      setAplicadorNome(encontrado.nome);
      setAplicadorNip(encontrado.nip);
      setAplicadorCategoria(encontrado.categoria);
      setAplicadorPostoGrad(postoGradAplicador(encontrado));
      setSenha('');
      setEtapa('rubrica');
    } finally {
      setVerificando(false);
    }
  }, [senha]);

  const iniciarRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setErroRubrica('');
    setRubricaStrokeAtual([{ x: locationX, y: locationY }]);
  }, []);

  const moverRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setRubricaStrokeAtual((prev) => [...prev, { x: locationX, y: locationY }]);
  }, []);

  const finalizarRubricaStroke = useCallback(() => {
    if (rubricaStrokeAtual.length === 0) return;
    setRubricaStrokes((prev) => [...prev, rubricaStrokeAtual]);
    setRubricaStrokeAtual([]);
  }, [rubricaStrokeAtual]);

  const confirmarRubrica = useCallback(() => {
    const strokesProntos = [
      ...rubricaStrokes.filter((s) => s.length > 0),
      ...(rubricaStrokeAtual.length > 0 ? [rubricaStrokeAtual] : []),
    ];
    if (strokesProntos.length === 0) {
      setErroRubrica('Desenhe a rúbrica do aplicador para continuar.');
      return;
    }
    if (!aplicadorId) return;
    const rubricaSvg = buildRubricaSvgDataUrl(
      strokesProntos,
      rubricaCanvasWidth,
      RUBRICA_CANVAS_HEIGHT,
      RUBRICA_COR_TRACO,
      RUBRICA_COR_FUNDO,
    );
    onConcluir({
      aplicadorId,
      nome: aplicadorNome,
      nip: aplicadorNip,
      categoria: aplicadorCategoria,
      postoGrad: aplicadorPostoGrad,
      rubricaSvg,
    });
  }, [
    aplicadorCategoria,
    aplicadorId,
    aplicadorNip,
    aplicadorNome,
    aplicadorPostoGrad,
    onConcluir,
    rubricaCanvasWidth,
    rubricaStrokeAtual,
    rubricaStrokes,
  ]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {etapa === 'senha' ? (
            <>
              <Text style={[styles.titulo, { color: theme.text }]}>Senha do aplicador</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                Após as rúbricas dos militares, informe a senha cadastrada para o aplicador assinar.
              </Text>
              <TextInput
                value={senha}
                onChangeText={(t) => {
                  setSenha(t);
                  setErroSenha('');
                }}
                placeholder="Senha"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
                ]}
              />
              {erroSenha ? (
                <Text style={[styles.erro, { color: theme.loss }]}>{erroSenha}</Text>
              ) : null}
              <TouchableOpacity
                onPress={() => void confirmarSenha()}
                disabled={verificando}
                style={[styles.btnPrimary, { backgroundColor: theme.primary, opacity: verificando ? 0.7 : 1 }]}
              >
                <Text style={[styles.btnPrimaryText, { color: theme.text }]}>
                  {verificando ? 'Verificando…' : 'Confirmar senha'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.titulo, { color: theme.text }]}>Rúbrica do aplicador</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                {aplicadorNome} · NIP {aplicadorNip || '—'}
              </Text>
              <View
                style={[styles.canvasWrap, { borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                onLayout={(e) => {
                  const w = e.nativeEvent.layout.width;
                  if (w > 0) setRubricaCanvasWidth(w);
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={iniciarRubricaStroke}
                onResponderMove={moverRubricaStroke}
                onResponderRelease={finalizarRubricaStroke}
                onResponderTerminate={finalizarRubricaStroke}
              >
                <Svg width="100%" height={RUBRICA_CANVAS_HEIGHT}>
                  {rubricaStrokes.map((stroke, idx) => (
                    <SvgPath
                      key={`aplic-stroke-${idx}`}
                      d={buildStrokePath(stroke)}
                      stroke={RUBRICA_COR_TRACO}
                      strokeWidth={2.2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                  {rubricaStrokeAtual.length > 0 ? (
                    <SvgPath
                      d={buildStrokePath(rubricaStrokeAtual)}
                      stroke={RUBRICA_COR_TRACO}
                      strokeWidth={2.2}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ) : null}
                </Svg>
              </View>
              <TouchableOpacity onPress={() => { setRubricaStrokes([]); setRubricaStrokeAtual([]); setErroRubrica(''); }}>
                <Text style={[styles.linkSec, { color: theme.textSecondary }]}>Limpar assinatura</Text>
              </TouchableOpacity>
              {erroRubrica ? <Text style={[styles.erro, { color: theme.loss }]}>{erroRubrica}</Text> : null}
              <TouchableOpacity
                onPress={confirmarRubrica}
                style={[styles.btnPrimary, { backgroundColor: theme.primary }]}
              >
                <Text style={[styles.btnPrimaryText, { color: theme.text }]}>Finalizar assinatura</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  titulo: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sub: { fontSize: 13, lineHeight: 19, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  erro: { fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  btnPrimary: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { fontWeight: '800', fontSize: 15 },
  canvasWrap: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  linkSec: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
});
