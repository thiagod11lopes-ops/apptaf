import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
  ScrollView,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getAllAplicadores, type AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
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
import { RUBRICA_NATIVA_ALTURA } from '../../utils/rubricaConstants';
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}} accessibilityViewIsModal>
      <AssinaturaFuturistaOverlay>
        <AssinaturaFuturistaScroll>
          <AssinaturaFuturistaCard accent="violet">
            {etapa === 'senha' ? (
              <>
                <AssinaturaFuturistaHeader
                  kicker="APLICADOR"
                  title="Assinatura do aplicador"
                  subtitle="Selecione o aplicador, informe a senha e desenhe a rúbrica."
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
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </AssinaturaFuturistaSelectList>
                )}

                <AssinaturaFuturistaFieldLabel>Senha</AssinaturaFuturistaFieldLabel>
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
                    { opacity: aplicadorSelecionadoId ? 1 : 0.6 },
                  ]}
                />
                {erroSenha ? <AssinaturaFuturistaError message={erroSenha} /> : null}

                <AssinaturaFuturistaBtnPrimary
                  label={verificando ? 'Verificando…' : 'Confirmar senha'}
                  onPress={() => void confirmarSenha()}
                  disabled={verificando || aplicadores.length === 0}
                  loading={verificando}
                  accent="violet"
                />
              </>
            ) : (
              <>
                <AssinaturaFuturistaHeader
                  kicker="APLICADOR"
                  title="Assinatura do aplicador"
                  subtitle={
                    aplicadorSelecionado
                      ? `${postoGradAplicador(aplicadorSelecionado)} ${aplicadorSelecionado.nome}`
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
                  canvasProps={{
                    onStartShouldSetResponder: () => true,
                    onMoveShouldSetResponder: () => true,
                    onResponderGrant: iniciarRubricaStroke,
                    onResponderMove: moverRubricaStroke,
                    onResponderRelease: finalizarRubricaStroke,
                    onResponderTerminate: finalizarRubricaStroke,
                  }}
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
                    label="Concluir assinatura"
                    onPress={concluirAssinatura}
                    disabled={!temTracoRubrica}
                    accent="violet"
                    flex
                  />
                </AssinaturaFuturistaBtnRow>
              </>
            )}
          </AssinaturaFuturistaCard>
        </AssinaturaFuturistaScroll>
      </AssinaturaFuturistaOverlay>
    </Modal>
  );
}
