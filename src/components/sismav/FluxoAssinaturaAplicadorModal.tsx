import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { PenLine } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getAllAplicadores,
  salvarRubricaAplicadorSeVazia,
  substituirRubricaAplicador,
  type AplicadorItemPersist,
} from '../../services/aplicadoresIndexedDb';
import { verificarSenhaAplicador, formatSenhaAplicadorInput, isSenhaAplicadorValid } from '../../utils/aplicadorSenha';
import {
  postoGradAplicador,
  type AplicadorAssinaturaResumo,
} from '../../types/aplicadorAssinatura';
import {
  buildRubricaSvgDataUrl,
  buildStrokePath,
  type RubricaStroke,
} from '../../utils/rubricaSvgBuilder';
import { RUBRICA_COR_TRACO } from '../../utils/rubricaSvgNormalize';
import { compareByNomePtBr } from '../../utils/compareNomePtBr';
import { RUBRICA_NATIVA_ALTURA } from '../../utils/rubricaConstants';
import { RubricaAlteradaToast } from './RubricaAlteradaToast';
import {
  AssinaturaFuturistaOverlay,
  AssinaturaFuturistaScroll,
  AssinaturaFuturistaCard,
  AssinaturaFuturistaHeader,
  AssinaturaFuturistaMetaChip,
  AssinaturaFuturistaCanvas,
  AssinaturaFuturistaError,
  AssinaturaFuturistaBtnRow,
  AssinaturaFuturistaBtnGhost,
  AssinaturaFuturistaBtnPrimary,
  AssinaturaFuturistaFieldLabel,
  assinaturaFuturistaInputStyle,
  AssinaturaFuturistaSelectList,
} from '../assinatura/AssinaturaFuturistaUi';

function labelAplicador(item: AplicadorItemPersist): string {
  const posto = postoGradAplicador(item);
  const nip = item.nip?.trim();
  const nome = posto !== '—' ? `${posto} ${item.nome}` : item.nome;
  return nip ? `${nome} (${nip})` : nome;
}

function resumoAssinatura(
  aplicador: AplicadorItemPersist,
  rubricaSvg: string,
): AplicadorAssinaturaResumo {
  return {
    aplicadorId: aplicador.id,
    nome: aplicador.nome,
    nip: aplicador.nip,
    categoria: aplicador.categoria,
    postoGrad: postoGradAplicador(aplicador),
    rubricaSvg,
  };
}

type Etapa = 'senha' | 'rubrica' | 'novaRubrica';

type Props = {
  visible: boolean;
  onConcluir: (assinatura: AplicadorAssinaturaResumo) => void;
  onCancelar?: () => void;
};

export function FluxoAssinaturaAplicadorModal({ visible, onConcluir, onCancelar }: Props) {
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
  const [salvandoRubrica, setSalvandoRubrica] = useState(false);
  const [mostrarAvisoTroca, setMostrarAvisoTroca] = useState(false);
  const [pendenteNovaRubricaSvg, setPendenteNovaRubricaSvg] = useState<string | null>(null);
  const [toastSucessoTroca, setToastSucessoTroca] = useState(false);
  const [assinaturaAposToast, setAssinaturaAposToast] = useState<AplicadorAssinaturaResumo | null>(
    null,
  );

  const aplicadorSelecionado = useMemo(
    () => aplicadores.find((a) => a.id === aplicadorSelecionadoId) ?? null,
    [aplicadores, aplicadorSelecionadoId],
  );

  const resetFluxo = useCallback(() => {
    setEtapa('senha');
    setSenha('');
    setErroSenha('');
    setErroRubrica('');
    setVerificando(false);
    setSalvandoRubrica(false);
    setAplicadorSelecionadoId('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setMostrarAvisoTroca(false);
    setPendenteNovaRubricaSvg(null);
    setToastSucessoTroca(false);
    setAssinaturaAposToast(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    resetFluxo();

    setCarregandoAplicadores(true);
    void getAllAplicadores()
      .then((lista) => {
        const ordenados = [...lista].sort(compareByNomePtBr);
        setAplicadores(ordenados);
      })
      .catch(() => setAplicadores([]))
      .finally(() => setCarregandoAplicadores(false));
  }, [visible, resetFluxo]);

  const selecionarAplicador = useCallback((id: string) => {
    setAplicadorSelecionadoId(id);
    setErroSenha('');
    setSenha('');
    setPendenteNovaRubricaSvg(null);
  }, []);

  const abrirAvisoTrocaRubrica = useCallback(() => {
    if (!aplicadorSelecionadoId) {
      setErroSenha('Selecione o aplicador antes de alterar a rúbrica.');
      return;
    }
    setErroSenha('');
    setMostrarAvisoTroca(true);
  }, [aplicadorSelecionadoId]);

  const continuarTrocaRubrica = useCallback(() => {
    setMostrarAvisoTroca(false);
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErroRubrica('');
    setEtapa('novaRubrica');
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
    if (!isSenhaAplicadorValid(senha)) {
      setErroSenha('A senha deve ter exatamente 4 números.');
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

      if (pendenteNovaRubricaSvg) {
        setSalvandoRubrica(true);
        try {
          const ok = await substituirRubricaAplicador(
            aplicadorSelecionado.id,
            pendenteNovaRubricaSvg,
          );
          if (!ok) {
            setErroSenha('Não foi possível alterar a rúbrica. Tente novamente.');
            return;
          }
          setAplicadores((prev) =>
            prev.map((a) =>
              a.id === aplicadorSelecionado.id
                ? { ...a, rubricaSvg: pendenteNovaRubricaSvg }
                : a,
            ),
          );
          const assinatura = resumoAssinatura(aplicadorSelecionado, pendenteNovaRubricaSvg);
          setPendenteNovaRubricaSvg(null);
          setAssinaturaAposToast(assinatura);
          setToastSucessoTroca(true);
        } finally {
          setSalvandoRubrica(false);
        }
        return;
      }

      const rubricaSalva = aplicadorSelecionado.rubricaSvg?.trim();
      if (rubricaSalva) {
        onConcluir(resumoAssinatura(aplicadorSelecionado, rubricaSalva));
        return;
      }

      setRubricaStrokes([]);
      setRubricaStrokeAtual([]);
      setErroRubrica('');
      setEtapa('rubrica');
    } finally {
      setVerificando(false);
    }
  }, [aplicadorSelecionado, onConcluir, pendenteNovaRubricaSvg, senha]);

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

  const montarSvgRubricaAtual = useCallback((): string | null => {
    const todos: RubricaStroke[] = [
      ...rubricaStrokes.filter((s) => s.length > 0),
      ...(rubricaStrokeAtual.length > 0 ? [rubricaStrokeAtual] : []),
    ];
    if (todos.length === 0) return null;
    return buildRubricaSvgDataUrl(todos, canvasWidth, RUBRICA_NATIVA_ALTURA);
  }, [canvasWidth, rubricaStrokeAtual, rubricaStrokes]);

  const concluirAssinatura = useCallback(async () => {
    if (!aplicadorSelecionado) return;

    const rubricaSvg = montarSvgRubricaAtual();
    if (!rubricaSvg) {
      setErroRubrica('Desenhe a rúbrica do aplicador antes de concluir.');
      return;
    }

    setSalvandoRubrica(true);
    setErroRubrica('');
    try {
      await salvarRubricaAplicadorSeVazia(aplicadorSelecionado.id, rubricaSvg);
      onConcluir(resumoAssinatura(aplicadorSelecionado, rubricaSvg));
    } catch {
      setErroRubrica('Não foi possível salvar a rúbrica. Tente novamente.');
    } finally {
      setSalvandoRubrica(false);
    }
  }, [aplicadorSelecionado, montarSvgRubricaAtual, onConcluir]);

  const confirmarNovaRubricaPendente = useCallback(() => {
    const rubricaSvg = montarSvgRubricaAtual();
    if (!rubricaSvg) {
      setErroRubrica('Desenhe a nova rúbrica antes de continuar.');
      return;
    }
    setPendenteNovaRubricaSvg(rubricaSvg);
    setSenha('');
    setErroSenha('');
    setErroRubrica('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setEtapa('senha');
  }, [montarSvgRubricaAtual]);

  const finalizarToastTroca = useCallback(() => {
    setToastSucessoTroca(false);
    if (assinaturaAposToast) {
      onConcluir(assinaturaAposToast);
      setAssinaturaAposToast(null);
    }
  }, [assinaturaAposToast, onConcluir]);

  const selectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: theme.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        marginBottom: 12,
        backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(255,255,255,0.65)',
        color: theme.text,
      }) as object,
    [theme],
  );

  const canvasResponderProps = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: iniciarRubricaStroke,
    onResponderMove: moverRubricaStroke,
    onResponderRelease: finalizarRubricaStroke,
    onResponderTerminate: finalizarRubricaStroke,
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancelar ?? (() => {})}
      accessibilityViewIsModal
    >
      <AssinaturaFuturistaOverlay>
        <AssinaturaFuturistaScroll>
          <AssinaturaFuturistaCard accent="violet">
            {etapa === 'senha' ? (
              <>
                <AssinaturaFuturistaHeader
                  kicker="APLICADOR"
                  title="Assinatura do aplicador"
                  subtitle={
                    pendenteNovaRubricaSvg
                      ? 'Nova rúbrica pronta. Digite a senha para confirmar a substituição.'
                      : 'Selecione o aplicador e informe a senha. Na primeira vez, a rúbrica será salva no cadastro.'
                  }
                  accent="violet"
                />

                <AssinaturaFuturistaFieldLabel>Aplicador</AssinaturaFuturistaFieldLabel>
                {carregandoAplicadores ? (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginBottom: 12 }} />
                ) : aplicadores.length === 0 ? (
                  <AssinaturaFuturistaError message="Nenhum aplicador cadastrado. Cadastre no menu Aplicador." />
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
                        {item.rubricaSvg?.trim() ? ' · rúbrica salva' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <AssinaturaFuturistaSelectList>
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
                      {aplicadores.map((item) => {
                        const active = item.id === aplicadorSelecionadoId;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            onPress={() => selecionarAplicador(item.id)}
                            style={{
                              paddingHorizontal: 14,
                              paddingVertical: 12,
                              backgroundColor: active ? theme.primary : 'transparent',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '600',
                                color: active ? theme.tokens.textOnPrimary : theme.textSecondary,
                              }}
                            >
                              {labelAplicador(item)}
                              {item.rubricaSvg?.trim() ? ' · rúbrica salva' : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </AssinaturaFuturistaSelectList>
                )}

                <AssinaturaFuturistaFieldLabel>Senha</AssinaturaFuturistaFieldLabel>
                <View style={styles.senhaRow}>
                  <TextInput
                    value={senha}
                    onChangeText={(t) => {
                      setSenha(formatSenhaAplicadorInput(t));
                      setErroSenha('');
                    }}
                    placeholder="0000"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={4}
                    editable={!!aplicadorSelecionadoId}
                    style={[
                      ...assinaturaFuturistaInputStyle(theme),
                      styles.senhaInput,
                      { opacity: aplicadorSelecionadoId ? 1 : 0.6, marginBottom: 0 },
                    ]}
                  />
                  <TouchableOpacity
                    accessibilityLabel="Alterar rúbrica do aplicador"
                    accessibilityRole="button"
                    onPress={abrirAvisoTrocaRubrica}
                    disabled={!aplicadorSelecionadoId}
                    style={[
                      styles.rubricaIconBtn,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? 'rgba(124,58,237,0.22)'
                          : 'rgba(124,58,237,0.1)',
                        opacity: aplicadorSelecionadoId ? 1 : 0.45,
                      },
                    ]}
                  >
                    <PenLine size={20} color={theme.primary} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>
                {pendenteNovaRubricaSvg ? (
                  <Text style={[styles.hintTroca, { color: theme.primary }]}>
                    Nova rúbrica capturada — confirme com a senha para substituir.
                  </Text>
                ) : null}
                {erroSenha ? <AssinaturaFuturistaError message={erroSenha} /> : null}

                {onCancelar ? (
                  <AssinaturaFuturistaBtnRow>
                    <AssinaturaFuturistaBtnGhost label="Cancelar" onPress={onCancelar} flex />
                    <AssinaturaFuturistaBtnPrimary
                      label={
                        verificando || salvandoRubrica
                          ? 'Verificando…'
                          : pendenteNovaRubricaSvg
                            ? 'Confirmar alteração'
                            : 'Confirmar senha'
                      }
                      onPress={() => void confirmarSenha()}
                      disabled={verificando || salvandoRubrica || aplicadores.length === 0}
                      loading={verificando || salvandoRubrica}
                      accent="violet"
                      flex
                    />
                  </AssinaturaFuturistaBtnRow>
                ) : (
                  <AssinaturaFuturistaBtnPrimary
                    label={
                      verificando || salvandoRubrica
                        ? 'Verificando…'
                        : pendenteNovaRubricaSvg
                          ? 'Confirmar alteração'
                          : 'Confirmar senha'
                    }
                    onPress={() => void confirmarSenha()}
                    disabled={verificando || salvandoRubrica || aplicadores.length === 0}
                    loading={verificando || salvandoRubrica}
                    accent="violet"
                  />
                )}
              </>
            ) : etapa === 'novaRubrica' ? (
              <>
                <AssinaturaFuturistaHeader
                  kicker="APLICADOR"
                  title="Nova rúbrica"
                  subtitle={
                    aplicadorSelecionado
                      ? `Desenhe a nova rúbrica de ${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome}.`
                      : 'Desenhe a nova rúbrica do aplicador.'
                  }
                  accent="violet"
                  onBack={() => {
                    setEtapa('senha');
                    setErroRubrica('');
                    setRubricaStrokes([]);
                    setRubricaStrokeAtual([]);
                  }}
                />

                {aplicadorSelecionado ? (
                  <AssinaturaFuturistaMetaChip
                    label="Identificação"
                    value={`${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome} · NIP ${aplicadorSelecionado.nip || '—'}`}
                  />
                ) : null}

                <AssinaturaFuturistaCanvas
                  accent="violet"
                  height={RUBRICA_NATIVA_ALTURA}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) setCanvasWidth(w);
                  }}
                  canvasProps={canvasResponderProps}
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
                </AssinaturaFuturistaCanvas>

                {erroRubrica ? <AssinaturaFuturistaError message={erroRubrica} /> : null}

                <AssinaturaFuturistaBtnRow>
                  <AssinaturaFuturistaBtnGhost label="Limpar" onPress={limparRubrica} flex />
                  <AssinaturaFuturistaBtnPrimary
                    label="OK"
                    onPress={confirmarNovaRubricaPendente}
                    disabled={!temTracoRubrica}
                    accent="violet"
                    flex
                  />
                </AssinaturaFuturistaBtnRow>
              </>
            ) : (
              <>
                <AssinaturaFuturistaHeader
                  kicker="APLICADOR"
                  title="Primeira rúbrica"
                  subtitle={
                    aplicadorSelecionado
                      ? `Desenhe a rúbrica de ${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome}. Ela ficará salva no cadastro.`
                      : 'Desenhe a rúbrica do aplicador.'
                  }
                  accent="violet"
                  onBack={() => {
                    setEtapa('senha');
                    setErroRubrica('');
                  }}
                />

                {aplicadorSelecionado ? (
                  <AssinaturaFuturistaMetaChip
                    label="Identificação"
                    value={`${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome} · NIP ${aplicadorSelecionado.nip || '—'}`}
                  />
                ) : null}

                <AssinaturaFuturistaCanvas
                  accent="violet"
                  height={RUBRICA_NATIVA_ALTURA}
                  onLayout={(e) => {
                    const w = e.nativeEvent.layout.width;
                    if (w > 0) setCanvasWidth(w);
                  }}
                  canvasProps={canvasResponderProps}
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
                </AssinaturaFuturistaCanvas>

                {erroRubrica ? <AssinaturaFuturistaError message={erroRubrica} /> : null}

                <AssinaturaFuturistaBtnRow>
                  <AssinaturaFuturistaBtnGhost label="Limpar" onPress={limparRubrica} flex />
                  <AssinaturaFuturistaBtnPrimary
                    label={salvandoRubrica ? 'Salvando…' : 'Salvar e concluir'}
                    onPress={() => void concluirAssinatura()}
                    disabled={!temTracoRubrica || salvandoRubrica}
                    loading={salvandoRubrica}
                    accent="violet"
                    flex
                  />
                </AssinaturaFuturistaBtnRow>
              </>
            )}
          </AssinaturaFuturistaCard>
        </AssinaturaFuturistaScroll>
      </AssinaturaFuturistaOverlay>

      <AppModal
        visible={mostrarAvisoTroca}
        transparent
        animationType="fade"
        onRequestClose={() => setMostrarAvisoTroca(false)}
        accessibilityViewIsModal
      >
        <AssinaturaFuturistaOverlay>
          <AssinaturaFuturistaScroll>
            <AssinaturaFuturistaCard accent="violet">
              <AssinaturaFuturistaHeader
                kicker="ATENÇÃO"
                title="Substituir rúbrica"
                subtitle="Se continuar, desenhar a nova rúbrica e confirmar com a senha, a rúbrica atual do aplicador será substituída."
                accent="violet"
              />
              <AssinaturaFuturistaBtnRow>
                <AssinaturaFuturistaBtnGhost
                  label="Cancelar"
                  onPress={() => setMostrarAvisoTroca(false)}
                  flex
                />
                <AssinaturaFuturistaBtnPrimary
                  label="Continuar"
                  onPress={continuarTrocaRubrica}
                  accent="violet"
                  flex
                />
              </AssinaturaFuturistaBtnRow>
            </AssinaturaFuturistaCard>
          </AssinaturaFuturistaScroll>
        </AssinaturaFuturistaOverlay>
      </AppModal>

      <RubricaAlteradaToast visible={toastSucessoTroca} onDone={finalizarToastTroca} />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  senhaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  senhaInput: {
    flex: 1,
    minWidth: 0,
  },
  rubricaIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  hintTroca: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: -4,
  },
});
