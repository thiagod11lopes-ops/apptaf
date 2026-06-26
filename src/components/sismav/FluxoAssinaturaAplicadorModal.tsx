import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  GestureResponderEvent,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllAplicadores, type AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { verificarSenhaAplicador } from '../../utils/aplicadorSenha';
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

function labelAplicador(item: AplicadorItemPersist): string {
  const nip = item.nip?.trim();
  return nip ? `${item.nome} (${nip})` : item.nome;
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
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [carregandoAplicadores, setCarregandoAplicadores] = useState(false);
  const [aplicadorSelecionadoId, setAplicadorSelecionadoId] = useState('');
  const [aplicadorId, setAplicadorId] = useState<string | null>(null);
  const [aplicadorNome, setAplicadorNome] = useState('');
  const [aplicadorNip, setAplicadorNip] = useState('');
  const [aplicadorCategoria, setAplicadorCategoria] = useState<'Oficiais' | 'Praças'>('Oficiais');
  const [aplicadorPostoGrad, setAplicadorPostoGrad] = useState('');
  const [rubricaStrokes, setRubricaStrokes] = useState<RubricaStroke[]>([]);
  const [rubricaStrokeAtual, setRubricaStrokeAtual] = useState<RubricaStroke>([]);
  const [rubricaCanvasWidth, setRubricaCanvasWidth] = useState(420);
  const [erroRubrica, setErroRubrica] = useState('');

  const aplicadorSelecionado = useMemo(
    () => aplicadores.find((a) => a.id === aplicadorSelecionadoId) ?? null,
    [aplicadores, aplicadorSelecionadoId],
  );

  useEffect(() => {
    if (!visible) return;
    setEtapa('senha');
    setSenha('');
    setErroSenha('');
    setVerificando(false);
    setAplicadorSelecionadoId('');
    setAplicadorId(null);
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErroRubrica('');

    setCarregandoAplicadores(true);
    void getAllAplicadores()
      .then((lista) => {
        const ordenados = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setAplicadores(ordenados);
      })
      .catch(() => setAplicadores([]))
      .finally(() => setCarregandoAplicadores(false));
  }, [visible]);

  const selecionarAplicador = useCallback(
    (id: string) => {
      setAplicadorSelecionadoId(id);
      setErroSenha('');
      const item = aplicadores.find((a) => a.id === id);
      setSenha(item?.senha?.trim() ?? '');
    },
    [aplicadores],
  );

  const confirmarSenha = useCallback(async () => {
    if (!aplicadorSelecionado) {
      setErroSenha('Selecione o aplicador.');
      return;
    }
    if (!senha.trim()) {
      setErroSenha('Informe a senha do aplicador.');
      return;
    }
    if (!aplicadorSelecionado.senhaHash) {
      setErroSenha('Este aplicador não possui senha cadastrada. Atualize no menu Aplicador.');
      return;
    }

    setVerificando(true);
    setErroSenha('');
    try {
      const senhaOk = await verificarSenhaAplicador(senha, aplicadorSelecionado.senhaHash);
      if (!senhaOk) {
        setErroSenha('Senha incorreta para o aplicador selecionado.');
        return;
      }
      setAplicadorId(aplicadorSelecionado.id);
      setAplicadorNome(aplicadorSelecionado.nome);
      setAplicadorNip(aplicadorSelecionado.nip);
      setAplicadorCategoria(aplicadorSelecionado.categoria);
      setAplicadorPostoGrad(postoGradAplicador(aplicadorSelecionado));
      setSenha('');
      setEtapa('rubrica');
    } finally {
      setVerificando(false);
    }
  }, [aplicadorSelecionado, senha]);

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

  const selectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: theme.backgroundSecondary,
        color: theme.text,
      }) as object,
    [theme],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}} accessibilityViewIsModal>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          {etapa === 'senha' ? (
            <>
              <Text style={[styles.titulo, { color: theme.text }]}>Senha do aplicador</Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                Após as rúbricas dos militares, selecione o aplicador e confirme a senha cadastrada.
              </Text>

              <Text style={[styles.label, { color: theme.textSecondary }]}>Aplicador</Text>
              {carregandoAplicadores ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.sub, { color: theme.textSecondary, marginBottom: 0 }]}>
                    Carregando aplicadores…
                  </Text>
                </View>
              ) : aplicadores.length === 0 ? (
                <Text style={[styles.erro, { color: theme.loss }]}>
                  Nenhum aplicador cadastrado. Cadastre no menu Aplicador.
                </Text>
              ) : Platform.OS === 'web' ? (
                <select
                  value={aplicadorSelecionadoId}
                  onChange={(e) => selecionarAplicador(e.target.value)}
                  style={selectWebStyle}
                >
                  <option value="">Selecione o aplicador</option>
                  {aplicadores.map((item) => (
                    <option key={item.id} value={item.id}>
                      {labelAplicador(item)}
                    </option>
                  ))}
                </select>
              ) : (
                <ScrollView
                  style={[
                    styles.selectList,
                    { borderColor: theme.border, backgroundColor: theme.backgroundSecondary },
                  ]}
                  nestedScrollEnabled
                >
                  {aplicadores.map((item) => {
                    const active = item.id === aplicadorSelecionadoId;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => selecionarAplicador(item.id)}
                        style={[
                          styles.selectOption,
                          active
                            ? { backgroundColor: theme.primary }
                            : { backgroundColor: theme.backgroundSecondary },
                        ]}
                      >
                        <Text
                          style={[
                            styles.selectOptionText,
                            { color: active ? theme.text : theme.textSecondary },
                          ]}
                        >
                          {labelAplicador(item)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              <Text style={[styles.label, { color: theme.textSecondary }]}>Senha</Text>
              <TextInput
                value={senha}
                onChangeText={(t) => {
                  setSenha(t);
                  setErroSenha('');
                }}
                placeholder="Senha do aplicador selecionado"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!!aplicadorSelecionadoId}
                style={[
                  styles.input,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundSecondary,
                    color: theme.text,
                    opacity: aplicadorSelecionadoId ? 1 : 0.6,
                  },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {},
                ]}
              />
              {erroSenha ? (
                <Text style={[styles.erro, { color: theme.loss }]}>{erroSenha}</Text>
              ) : null}
              <TouchableOpacity
                onPress={() => void confirmarSenha()}
                disabled={verificando || aplicadores.length === 0}
                style={[
                  styles.btnPrimary,
                  {
                    backgroundColor: theme.primary,
                    opacity: verificando || aplicadores.length === 0 ? 0.7 : 1,
                  },
                ]}
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
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  selectList: {
    maxHeight: 160,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  selectOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectOptionText: { fontSize: 15, fontWeight: '600' },
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
