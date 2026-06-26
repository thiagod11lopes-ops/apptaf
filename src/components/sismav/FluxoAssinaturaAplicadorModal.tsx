import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActivityIndicator,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllAplicadores, type AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import { verificarSenhaAplicador } from '../../utils/aplicadorSenha';
import {
  postoGradAplicador,
  type AplicadorAssinaturaResumo,
} from '../../types/aplicadorAssinatura';
import {
  buildRubricaSvgDataUrl,
  buildStrokePath,
  type RubricaStroke,
} from '../../utils/rubricaSvgBuilder';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../../utils/rubricaConstants';

function labelAplicador(item: AplicadorItemPersist): string {
  const posto = postoGradAplicador(item);
  const nip = item.nip?.trim();
  const nome = posto !== '—' ? `${posto} ${item.nome}` : item.nome;
  return nip ? `${nome} (${nip})` : nome;
}

type Etapa = 'senha' | 'rubrica';

type Props = {
  visible: boolean;
  onConcluir: (assinatura: AplicadorAssinaturaResumo) => void;
};

export function FluxoAssinaturaAplicadorModal({ visible, onConcluir }: Props) {
  const { theme } = useTheme();
  const [etapa, setEtapa] = useState<Etapa>('senha');
  const [senha, setSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [aplicadores, setAplicadores] = useState<AplicadorItemPersist[]>([]);
  const [carregandoAplicadores, setCarregandoAplicadores] = useState(false);
  const [aplicadorSelecionadoId, setAplicadorSelecionadoId] = useState('');
  const [rubricaStrokes, setRubricaStrokes] = useState<RubricaStroke[]>([]);
  const [rubricaStrokeAtual, setRubricaStrokeAtual] = useState<RubricaStroke>([]);
  const [canvasWidth, setCanvasWidth] = useState(420);
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
    setErroRubrica('');
    setVerificando(false);
    setAplicadorSelecionadoId('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);

    setCarregandoAplicadores(true);
    void getAllAplicadores()
      .then((lista) => {
        const ordenados = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        setAplicadores(ordenados);
      })
      .catch(() => setAplicadores([]))
      .finally(() => setCarregandoAplicadores(false));
  }, [visible]);

  const selecionarAplicador = useCallback((id: string) => {
    setAplicadorSelecionadoId(id);
    setErroSenha('');
    setSenha('');
  }, []);

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
      setRubricaStrokes([]);
      setRubricaStrokeAtual([]);
      setErroRubrica('');
      setEtapa('rubrica');
    } finally {
      setVerificando(false);
    }
  }, [aplicadorSelecionado, senha]);

  const iniciarRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setRubricaStrokeAtual([{ x: locationX, y: locationY }]);
    setErroRubrica('');
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

  const limparRubrica = useCallback(() => {
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErroRubrica('');
  }, []);

  const temTracoRubrica =
    rubricaStrokes.some((s) => s.length > 0) || rubricaStrokeAtual.length > 0;

  const concluirAssinatura = useCallback(() => {
    if (!aplicadorSelecionado) return;

    const todos: RubricaStroke[] = [
      ...rubricaStrokes.filter((s) => s.length > 0),
      ...(rubricaStrokeAtual.length > 0 ? [rubricaStrokeAtual] : []),
    ];
    if (todos.length === 0) {
      setErroRubrica('Desenhe a rúbrica do aplicador antes de concluir.');
      return;
    }

    const rubricaSvg = buildRubricaSvgDataUrl(todos, canvasWidth, RUBRICA_NATIVA_ALTURA);
    onConcluir({
      aplicadorId: aplicadorSelecionado.id,
      nome: aplicadorSelecionado.nome,
      nip: aplicadorSelecionado.nip,
      categoria: aplicadorSelecionado.categoria,
      postoGrad: postoGradAplicador(aplicadorSelecionado),
      rubricaSvg,
    });
  }, [aplicadorSelecionado, canvasWidth, onConcluir, rubricaStrokeAtual, rubricaStrokes]);

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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Text style={[styles.titulo, { color: theme.text }]}>Assinatura do aplicador</Text>

            {etapa === 'senha' ? (
              <>
                <Text style={[styles.sub, { color: theme.textSecondary }]}>
                  Selecione o aplicador e informe a senha cadastrada. Em seguida, ele fará a rúbrica.
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
                  placeholder="Digite a senha do aplicador"
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
                {erroSenha ? <Text style={[styles.erro, { color: theme.loss }]}>{erroSenha}</Text> : null}
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
                <Text style={[styles.sub, { color: theme.textSecondary }]}>
                  {aplicadorSelecionado
                    ? `${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome} — desenhe a rúbrica abaixo.`
                    : 'Desenhe a rúbrica do aplicador.'}
                </Text>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Rúbrica do aplicador</Text>
                <View
                  style={[
                    styles.canvasWrap,
                    { borderColor: theme.border, backgroundColor: RUBRICA_COR_FUNDO },
                  ]}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) setCanvasWidth(w);
                  }}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={iniciarRubricaStroke}
                  onResponderMove={moverRubricaStroke}
                  onResponderRelease={finalizarRubricaStroke}
                  onResponderTerminate={finalizarRubricaStroke}
                >
                  <Svg width="100%" height={RUBRICA_NATIVA_ALTURA}>
                    {rubricaStrokes.map((stroke, idx) => (
                      <SvgPath
                        key={`stroke-${idx}`}
                        d={buildStrokePath(stroke)}
                        stroke={RUBRICA_COR_TRACO}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {rubricaStrokeAtual.length > 0 ? (
                      <SvgPath
                        d={buildStrokePath(rubricaStrokeAtual)}
                        stroke={RUBRICA_COR_TRACO}
                        strokeWidth={2.5}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                  </Svg>
                </View>

                <TouchableOpacity
                  onPress={limparRubrica}
                  style={[styles.btnSecundario, { borderColor: theme.border }]}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Limpar rúbrica</Text>
                </TouchableOpacity>

                {erroRubrica ? <Text style={[styles.erro, { color: theme.loss }]}>{erroRubrica}</Text> : null}

                <View style={styles.footerBtns}>
                  <TouchableOpacity
                    onPress={() => {
                      setEtapa('senha');
                      setErroRubrica('');
                    }}
                    style={[styles.btnGhost, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.textSecondary, fontWeight: '700' }}>Voltar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={concluirAssinatura}
                    disabled={!temTracoRubrica}
                    style={[
                      styles.btnPrimaryFlex,
                      {
                        backgroundColor: theme.primary,
                        opacity: temTracoRubrica ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text style={[styles.btnPrimaryText, { color: theme.text }]}>Concluir assinatura</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
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
  canvasWrap: {
    width: '100%',
    height: RUBRICA_NATIVA_ALTURA,
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  btnSecundario: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  erro: { fontSize: 13, fontWeight: '600', marginBottom: 10, textAlign: 'center' },
  btnPrimary: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryFlex: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { fontWeight: '800', fontSize: 15 },
  footerBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  btnGhost: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
});
