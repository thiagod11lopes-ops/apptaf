import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useLayoutEffect,
  useRef,
  useReducer,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  GestureResponderEvent,
  KeyboardAvoidingView,
  AppState,
  type AppStateStatus,
  InteractionManager,
} from 'react-native';
import { AppModal } from '../components/premium/AppModal';
import { SafeAreaView as SafeAreaViewInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import { AplicarTafShell } from '../components/taf/aplicar/AplicarTafShell';
import {
  AplicarTafFlowHeader,
  AplicarTafCenteredTabHeader,
  AplicarTafGlassPanel,
  AplicarTafSectionHeader,
  AplicarTafBackLink,
  AplicarTafPrimaryButton,
} from '../components/taf/aplicar/AplicarTafUi';
import { AplicarTafHomeLauncher } from '../components/taf/aplicar/AplicarTafHomeLauncher';
import { AplicarTafFatoresRiscoPanel } from '../components/taf/aplicar/AplicarTafFatoresRiscoPanel';
import { AplicarTafRestritosPanel } from '../components/taf/aplicar/AplicarTafRestritosPanel';
import {
  FatoresRiscoInfoModal,
} from '../components/taf/aplicar/FatoresRiscoInfoModal';
import { AplicarTafProvaSelector } from '../components/taf/aplicar/AplicarTafProvaSelector';
import {
  AplicarTafNipsList,
  type NipFeedbackLinha,
} from '../components/taf/aplicar/AplicarTafNipsList';
import {
  AplicarTafPreCadastroCard,
  PRE_CADASTRO_ACCENTS,
} from '../components/taf/aplicar/AplicarTafPreCadastroCard';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { AplicarTafModoTesteBar } from '../components/taf/aplicar/AplicarTafModoTesteBar';
import {
  EditarIdadeGeneroMilitarModal,
  type EditarDadosMilitarPayload,
} from '../components/taf/aplicar/EditarIdadeGeneroMilitarModal';
import { ConfirmacaoExcluirParticipanteNipModal } from '../components/taf/aplicar/ConfirmacaoExcluirParticipanteNipModal';
import { ContinuidadeProvaAtivaModal } from '../components/taf/aplicar/ContinuidadeProvaAtivaModal';
import { CadastroRapidoMilitarModal } from '../components/taf/aplicar/CadastroRapidoMilitarModal';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ModalTesteJaAplicado,
  type ModalTesteJaAplicadoInfo,
} from '../components/sismav/ModalTesteJaAplicado';
import {
  ModalModalidadeExcludente,
  type ModalModalidadeExcludenteInfo,
} from '../components/sismav/ModalModalidadeExcludente';
import { ConfirmacaoExcluirPreCadastroModal } from '../components/sismav/ConfirmacaoExcluirPreCadastroModal';
import { FluxoAssinaturaAplicadorModal } from '../components/sismav/FluxoAssinaturaAplicadorModal';
import { AplicarTafRubricaCandidatoModal } from './aplicarTaf/AplicarTafRubricaCandidatoModal';
import {
  MAX_PARTICIPANTES,
  NUMERO_VOLTAS_PADRAO,
  PERMANENCIA_DURACAO_MS,
  MAX_VOLTAS_COLUNAS,
  formatNipInput,
  trialTipoFromProva,
  limiteParticipantesPreCadastro,
  camposCadastroParaFeedback,
  labelTipoProvaPreCadastro,
  metaPreCadastro,
  buildRubricaSvgDataUrl,
  type CorridaEtapa,
} from './aplicarTaf/aplicarTafScreenHelpers';
import { createAplicarTafStyles } from './aplicarTaf/aplicarTafScreenStyles';
import {
  type ResultadoPermanenciaOpcao,
} from '../components/PermanenciaTafPanel';
import {
  TafProvaTempoModal,
  type TafProvaTempoModalProva,
} from '../components/taf/TafProvaTempoModal';
import { getAllCadastros, addCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  addSessaoAplicacao,
  getAllSessoesAplicacao,
  getSessaoAplicacaoById,
  updateSessaoAplicacao,
} from '../services/resultadosAplicadosIndexedDb';
import {
  clearProvaAtivaSession,
  loadProvaAtivaSession,
  markContinuidadeModalOffered,
  resolveCronometroElapsedMs,
  saveProvaAtivaSession,
  shouldOfferContinuidadeModal,
  type ProvaAtivaSessionV1,
} from '../services/provaAtivaSessionStorage';
import { persistirRubricasNoCadastro } from '../utils/persistirRubricaCadastro';
import {
  isRubricaRasterDataUrl,
  isRubricaSvgDataUrl,
  rubricaParaPersistenciaAsync,
} from '../utils/rubricaRasterPersist';
import { yieldEveryN, yieldToUiHeavy } from '../utils/yieldToUi';
import { RUBRICA_LOTE_YIELD_A_CADA, RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import {
  buscarRegistroModalidadeExistente,
  removerParticipanteModalidadeDoHistorico,
} from '../utils/registroModalidadeHistorico';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import {
  filtrarCadastrosDemonstracao,
  nipFeedbackOkFromCadastro,
} from '../utils/aplicarTafDemonstracao';
import { DEMO_TOTAL_CFN, DEMO_TOTAL_MILITARES } from '../utils/gerarDadosDemonstracaoTaf';
import {
  isModoDemonstracaoAtivo,
  desativarModoDemonstracaoSeAtivo,
  subscribeModoDemonstracao,
} from '../services/modoDemonstracao';
import { cadastroPrecisaCompletarDadosTaf, dataNascimentoCadastroValida, vinculoCadastroValido } from '../utils/cadastroDadosTaf';
import { dataHojeBr } from '../utils/tafRegistro';
import { detectarConflitoCorridaCaminhada, removerModalidadeOpostaDistanciaDoHistorico } from '../utils/corridaCaminhadaExcludente';
import { formatMsByModality, parseTafPerformanceInput, type TafModality } from '../taf/tafTimeFormat';
import {
  formatNotaDesistenciaCorrida,
  isNotaReprovacaoTexto,
} from '../utils/notaReprovacaoTexto';
import {
  formatNomeComPosto,
  primeiroSegundoNomeComPosto,
} from '../utils/formatNomeComPosto';
import {
  notaCaminhadaParaPersistencia,
  textoNotaCaminhadaFromCadastro,
} from '../taf/caminhada4800Nota';
import {
  type TipoProvaTAF,
  isProvaComVoltas,
  isProvaComRepeticoes,
  tituloProvaTaf,
  labelAtletaProva,
} from '../taf/tafProvaTypes';
import { TafProvaRepeticoesModal } from '../components/taf/TafProvaRepeticoesModal';
import {
  calcularNotaLinhaTempo,
  calcularNotaLinhaReps,
  aplicarResultadoNoCadastro,
  aplicarDesistenciaNoCadastro,
} from './aplicarTafNotaHelpers';
import { useTafTimeFormat } from '../hooks/useTafTimeFormat';
import { useTafReactStopwatch } from '../hooks/useTafReactStopwatch';
import { useRubricaStrokeDraw } from '../hooks/useRubricaStrokeDraw';
import type { RootStackParamList, ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import {
  aplicarTafTrialReducer,
  initialTrialTableState,
  ultimaMarcacaoLaranjaKey,
} from './aplicarTafTrialReducer';
import {
  addPreCadastroTaf,
  getAllPreCadastrosTaf,
  isNomeCodigoPreCadastro,
  MAX_PRE_CADASTRO_PARTICIPANTES,
  nomesCodigoDisponiveis,
  removePreCadastroTaf,
  type NomeCodigoPreCadastro,
  type PreCadastroTaf,
} from '../services/preCadastroTafStorage';
import {
  getAllFatoresRisco,
  listarAlertasFatoresRisco,
  temAlertaFatorRisco,
  type FatoresRiscoRegistro,
} from '../services/fatoresRiscoStorage';
import { nipDigitos } from '../utils/nipFormat';

export default function AplicarTAFScreen() {
  const { theme } = useTheme();
  const ts = theme.textStyles;
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const styles = useMemo(() => createAplicarTafStyles(theme, ui), [theme, ui]);
  const { horizontalPad, scrollBottomPad, insets } = useAplicarTafLayout();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const grayBg = theme.background;
  const selectedBgColor = theme.primary;
  const selectedTextColor = theme.text;
  const inputBg = theme.cardBg;
  const inputBorder = ui.inputBorder;
  const inputTextColor = ui.text;
  const [mostrarListaPreCadastro, setMostrarListaPreCadastro] = useState(false);
  const [mostrarFatoresRisco, setMostrarFatoresRisco] = useState(false);
  /** De onde o painel de fatores foi aberto — define o destino do Voltar. */
  const [fatoresRiscoOrigem, setFatoresRiscoOrigem] = useState<'home' | 'nips' | null>(null);
  const [fatoresRiscoNipInicial, setFatoresRiscoNipInicial] = useState<string | null>(null);
  const [fatoresRiscoNomeInicial, setFatoresRiscoNomeInicial] = useState<string | null>(null);
  const [mostrarRestritos, setMostrarRestritos] = useState(false);
  const [fatoresRiscoPorNip, setFatoresRiscoPorNip] = useState<Record<string, FatoresRiscoRegistro>>(
    {},
  );
  const [modalFatoresRiscoInfo, setModalFatoresRiscoInfo] = useState<{
    nome: string;
    nip: string;
    fatores: string[];
  } | null>(null);
  const [modalEditarIdadeGeneroIndex, setModalEditarIdadeGeneroIndex] = useState<number | null>(
    null,
  );
  const [participanteNipParaExcluir, setParticipanteNipParaExcluir] = useState<number | null>(null);
  /** De onde o modal de exclusão foi aberto — ajusta o texto de ajuda. */
  const [exclusaoParticipanteOrigem, setExclusaoParticipanteOrigem] = useState<'nips' | 'prova'>(
    'nips',
  );
  const [modalCadastroRapido, setModalCadastroRapido] = useState<{
    index: number;
    nip: string;
  } | null>(null);
  const [modoPreCadastro, setModoPreCadastro] = useState(false);
  const [modoTafNaval, setModoTafNaval] = useState(false);
  const [repeticoesParticipantes, setRepeticoesParticipantes] = useState<string[]>([]);
  const [listaPreCadastros, setListaPreCadastros] = useState<PreCadastroTaf[]>([]);
  const [preCadastroParaExcluir, setPreCadastroParaExcluir] = useState<PreCadastroTaf | null>(null);
  const [excluindoPreCadastro, setExcluindoPreCadastro] = useState(false);
  const [preCadastroEditando, setPreCadastroEditando] = useState<PreCadastroTaf | null>(null);
  /** Nome OTAN do pré-cadastro (Alfa…Zulu) ou `Nenhum` (só numeração). */
  const [nomeCodigoPreCadastro, setNomeCodigoPreCadastro] = useState<
    NomeCodigoPreCadastro | 'Nenhum' | null
  >(null);
  const [mostrarProvas, setMostrarProvas] = useState(false);
  const [tipoProva, setTipoProva] = useState<TipoProvaTAF | null>(null);
  const tipoProvaRef = useRef<TipoProvaTAF | null>(null);
  /** Antes do paint, para o cronômetro nunca formatar corrida (MM:SS) durante natação. */
  useLayoutEffect(() => {
    tipoProvaRef.current = tipoProva;
  }, [tipoProva]);
  useEffect(() => subscribeModoDemonstracao(() => setDemoAtivo(isModoDemonstracaoAtivo())), []);
  const modalityTime: TafModality =
    tipoProva === 'natacao' || tipoProva === 'abdominal_prancha' ? 'natacao' : 'corrida';
  const { formatMs } = useTafTimeFormat(modalityTime);
  const [corridaEtapa, setCorridaEtapa] = useState<CorridaEtapa>('menu');
  const [erroParticipantes, setErroParticipantes] = useState('');
  const [nipsParticipantes, setNipsParticipantes] = useState<string[]>([]);
  const nParticipantesConfirmado = nipsParticipantes.length;
  const [nipFeedbackLinhas, setNipFeedbackLinhas] = useState<NipFeedbackLinha[]>([]);
  const [demoAtivo, setDemoAtivo] = useState(isModoDemonstracaoAtivo);
  const [preenchendoNipsDemo, setPreenchendoNipsDemo] = useState(false);
  const [modalTesteExistente, setModalTesteExistente] = useState<
    (ModalTesteJaAplicadoInfo & { dataNascimento: string; sexo?: 'M' | 'F' }) | null
  >(null);
  const [modalModalidadeExcludente, setModalModalidadeExcludente] = useState<
    (ModalModalidadeExcludenteInfo & { cadastro: CadastroItemPersist }) | null
  >(null);
  const nipsRepeticaoAutorizadaRef = useRef<Set<number>>(new Set());
  const [numeroVoltas, setNumeroVoltas] = useState(NUMERO_VOLTAS_PADRAO);
  /** Corrida/caminhada: número de voltas já confirmado (também persistido na sessão). */
  const [voltasConfirmadasProva, setVoltasConfirmadasProva] = useState(false);
  /** Voltas, chegadas e tempos em um único reducer (atualização atômica por clique). */
  const [trialTable, dispatchTrial] = useReducer(aplicarTafTrialReducer, initialTrialTableState);
  const {
    checksVoltas,
    chegadaNatacao,
    temposMilitaresMs,
    desistenciaParticipantes,
    desistenciaVoltasParticipantes,
  } = trialTable;

  const [continuidadeProvaVisible, setContinuidadeProvaVisible] = useState(false);
  const [continuidadeProvaMeta, setContinuidadeProvaMeta] = useState<{
    provaLabel: string;
    participantesCount: number;
  } | null>(null);
  const suppressPersistProvaRef = useRef(false);
  const provaAtivaRestauradaRef = useRef(false);
  const nipsScrollRef = useRef<ScrollView>(null);
  const nipsFimAnchorRef = useRef<View>(null);
  const scrollNipsAposAddRef = useRef(false);

  /** Após “Aplicar Resultado”: tempos gravados no cadastro. */
  const [salvandoResultadosCorrida, setSalvandoResultadosCorrida] = useState(false);
  /** Trava síncrona: o state `salvando` só atualiza no próximo render — evita duplo clique. */
  const aplicandoResultadoLockRef = useRef(false);
  const [modalTempoRegistradoVisible, setModalTempoRegistradoVisible] = useState(false);
  const [modalParcialAviso, setModalParcialAviso] = useState<string | null>(null);
  const pendingResultadosNavRef = useRef<ResultadoCorridaItem[] | null>(null);
  /** Fila de lote: WebP + um write IDB ao abrir o aplicador (não bloqueia UI). */
  const rubricaPersistChainRef = useRef(Promise.resolve());
  const rubricaPersistGeracaoRef = useRef(0);
  const resultadosPosMilitaresRef = useRef<ResultadoCorridaItem[] | null>(null);
  /** Pré-cadastro que originou a prova ativa (excluído após lançamento confirmado). */
  const preCadastroOrigemIdRef = useRef<string | null>(null);
  /**
   * Buffers do lançamento em curso. Ao aplicar o resultado, cadastros/sessão já são
   * gravados; os buffers e `sessaoAplicacaoIdRef` servem para rúbricas incrementais
   * e restauração da prova ativa.
   */
  const pendingCadastrosRef = useRef<CadastroItemPersist[]>([]);
  const pendingCleanupsRef = useRef<Array<() => Promise<void>>>([]);
  const sessaoAplicacaoIdRef = useRef<string | null>(null);
  /** Lista estável no state (abertura/restauração); SVGs e mutações ficam em refs. */
  const [listaResultadosRubricaNatacao, setListaResultadosRubricaNatacao] = useState<
    ResultadoCorridaItem[] | null
  >(null);
  const [modalRubricaNatacaoVisible, setModalRubricaNatacaoVisible] = useState(false);
  const [fluxoAplicadorVisible, setFluxoAplicadorVisible] = useState(false);
  const [indiceRubricaNatacao, setIndiceRubricaNatacao] = useState(0);
  const rubricasSvgRef = useRef<string[]>([]);
  const [erroRubricaNatacao, setErroRubricaNatacao] = useState('');
  const {
    strokes: rubricaStrokes,
    strokeAtual: rubricaStrokeAtual,
    iniciar: iniciarRubricaStrokePoint,
    mover: moverRubricaStrokePoint,
    finalizar: finalizarRubricaStroke,
    limpar: limparRubricaDraw,
    getTodosStrokes: getTodosStrokesRubrica,
  } = useRubricaStrokeDraw();
  const [rubricaCanvasWidth, setRubricaCanvasWidth] = useState(420);

  const [resultadoPermanenciaLinhas, setResultadoPermanenciaLinhas] = useState<
    ResultadoPermanenciaOpcao[]
  >([]);
  const [modalPermanenciaFinalizadaVisible, setModalPermanenciaFinalizadaVisible] =
    useState(false);
  const [erroPermanencia, setErroPermanencia] = useState('');

  const ultimaMarcacaoChecklistKey = useMemo(
    () =>
      ultimaMarcacaoLaranjaKey(trialTable, {
        permanenteAprovadoAtivo: (p) => resultadoPermanenciaLinhas[p] === 'aprovado',
      }),
    [trialTable, resultadoPermanenciaLinhas],
  );

  const stopwatch = useTafReactStopwatch({
    getMaxMs: () =>
      tipoProvaRef.current === 'permanencia' ? PERMANENCIA_DURACAO_MS : null,
    onMaxReached: () => setModalPermanenciaFinalizadaVisible(true),
  });

  const cronometroEstado = stopwatch.estado;
  const tempoExibido = stopwatch.tempoExibido;
  const cronometroPausadoTexto = stopwatch.pausadoTexto;
  const cronometroPausadoTextoRef = stopwatch.pausadoTextoRef;
  const tempoParadoMsRef = stopwatch.tempoParadoMsRef;
  const resetCronometroCorrida = stopwatch.resetCronometro;
  const getElapsedRaceMs = stopwatch.getElapsedMs;
  const onCronometroPausadoTextoChange = stopwatch.onPausadoTextoChange;
  const onBlurCronometroPausado = stopwatch.onBlurPausado;

  const iniciarCronometroCorrida = stopwatch.iniciar;
  const pausarCronometroCorrida = stopwatch.pausar;
  const continuarCronometroCorrida = useCallback(() => {
    if (!stopwatch.continuar()) {
      Alert.alert(
        'Tempo inválido',
        'Use MM:SS:CS (ex.: 01:30:00). Segundos 00–59 e centésimos 00–99.',
      );
    }
  }, [stopwatch.continuar]);

  const pararCronometroCorrida = useCallback(() => {
    if (!stopwatch.parar()) {
      Alert.alert(
        'Tempo inválido',
        'Use MM:SS:CS (ex.: 01:30:00). Segundos 00–59 e centésimos 00–99.',
      );
    }
  }, [stopwatch.parar]);

  const onChangeNumeroVoltas = useCallback((text: string) => {
    setNumeroVoltas(text.replace(/\D/g, '').slice(0, 4));
  }, []);

  /** Quantidade de colunas de volta à direita de “Nome” (conforme o campo Número de Voltas). */
  const nColunasVoltas = useMemo(() => {
    const n = parseInt(numeroVoltas.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n) || n < 1) return 0;
    return Math.min(n, MAX_VOLTAS_COLUNAS);
  }, [numeroVoltas]);

  /** Corrida: coluna “Tempo” só após alguém marcar a última volta. */
  const mostrarColunaTempoCorrida = useMemo(() => {
    if (nColunasVoltas < 1) return false;
    const ultima = nColunasVoltas - 1;
    return checksVoltas.some((row) => row?.[ultima]);
  }, [nColunasVoltas, checksVoltas]);

  /**
   * Natação: coluna “Tempo” fica sempre ao lado de “Marcar chegada”; o valor é gravado
   * no instante do clique (elapsed do cronômetro). Corrida: só após última volta.
   */
  const mostrarColunaTempo =
    tipoProva === 'natacao' ||
    tipoProva === 'abdominal_prancha' ||
    tipoProva === 'permanencia'
      ? true
      : mostrarColunaTempoCorrida ||
        (tipoProva === 'corrida' && desistenciaParticipantes.some(Boolean));

  /** Nota corrida: exige coluna de tempo visível. */
  const mostrarColunaNotaCorrida = tipoProva === 'corrida' && mostrarColunaTempo;
  const mostrarColunaNotaCaminhada = tipoProva === 'caminhada' && mostrarColunaTempo;
  const mostrarColunaNotaNatacao = tipoProva === 'natacao';
  const mostrarColunaNotaPrancha = tipoProva === 'abdominal_prancha';

  const notaCorridaPorLinha = useMemo(() => {
    if (!mostrarColunaNotaCorrida) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (desistenciaParticipantes[i]) {
        out.push(formatNotaDesistenciaCorrida(desistenciaVoltasParticipantes[i] ?? 0));
        continue;
      }
      const fb = nipFeedbackLinhas[i];
      const ms = temposMilitaresMs[i];
      if (fb?.tipo !== 'ok' || ms == null) {
        out.push('—');
        continue;
      }
      out.push(calcularNotaLinhaTempo('corrida', ms, fb, modoTafNaval));
    }
    return out;
  }, [
    mostrarColunaNotaCorrida,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
    desistenciaParticipantes,
    desistenciaVoltasParticipantes,
    modoTafNaval,
  ]);

  const notaCaminhadaPorLinha = useMemo(() => {
    if (!mostrarColunaNotaCaminhada) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const fb = nipFeedbackLinhas[i];
      const ms = temposMilitaresMs[i];
      if (fb?.tipo !== 'ok' || ms == null) {
        out.push('—');
        continue;
      }
      const tempoStr = formatMsByModality('corrida', ms);
      out.push(
        textoNotaCaminhadaFromCadastro({
          tempoCaminhada: tempoStr,
          dataNascimento: fb.dataNascimento,
          sexo: fb.sexo,
        }),
      );
    }
    return out;
  }, [
    mostrarColunaNotaCaminhada,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
  ]);

  const notaNatacaoPorLinha = useMemo(() => {
    if (tipoProva !== 'natacao') return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (desistenciaParticipantes[i]) {
        out.push('REPROVADO');
        continue;
      }
      const fb = nipFeedbackLinhas[i];
      const ms = temposMilitaresMs[i];
      const marcado = chegadaNatacao[i] ?? false;
      if (fb?.tipo !== 'ok' || ms == null || !marcado) {
        out.push('—');
        continue;
      }
      out.push(calcularNotaLinhaTempo('natacao', ms, fb, modoTafNaval));
    }
    return out;
  }, [
    tipoProva,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
    chegadaNatacao,
    desistenciaParticipantes,
    modoTafNaval,
  ]);

  const notaPranchaPorLinha = useMemo(() => {
    if (!mostrarColunaNotaPrancha) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const fb = nipFeedbackLinhas[i];
      const ms = temposMilitaresMs[i];
      const marcado = chegadaNatacao[i] ?? false;
      if (fb?.tipo !== 'ok' || ms == null || !marcado) {
        out.push('—');
        continue;
      }
      out.push(calcularNotaLinhaTempo('abdominal_prancha', ms, fb, true));
    }
    return out;
  }, [
    mostrarColunaNotaPrancha,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
    chegadaNatacao,
  ]);

  const notaRepeticoesPorLinha = useMemo(() => {
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const fb = nipFeedbackLinhas[i];
      const raw = (repeticoesParticipantes[i] ?? '').trim();
      if (fb?.tipo !== 'ok' || !raw) {
        out.push('—');
        continue;
      }
      const reps = parseInt(raw, 10);
      if (!Number.isFinite(reps)) {
        out.push('—');
        continue;
      }
      out.push(
        calcularNotaLinhaReps(
          tipoProva as 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
          reps,
          fb,
        ),
      );
    }
    return out;
  }, [tipoProva, nParticipantesConfirmado, nipFeedbackLinhas, repeticoesParticipantes]);

  /** Todos com tempo registrado (corrida: última volta; natação: chegada) ou desistência. */
  const todosIntegrantesComTempoRegistrado = useMemo(() => {
    const p = nParticipantesConfirmado;
    if (p < 1) return false;
    const completo = (i: number) =>
      desistenciaParticipantes[i] === true || temposMilitaresMs[i] != null;

    if (tipoProva === 'natacao' || tipoProva === 'abdominal_prancha') {
      if (temposMilitaresMs.length < p && desistenciaParticipantes.length < p) return false;
      for (let i = 0; i < p; i += 1) {
        if (!completo(i)) return false;
      }
      return true;
    }
    if (nColunasVoltas < 1) {
      // Corrida sem voltas: só libera se todos desistiram.
      if (tipoProva === 'corrida') {
        for (let i = 0; i < p; i += 1) {
          if (!desistenciaParticipantes[i]) return false;
        }
        return true;
      }
      return false;
    }
    if (temposMilitaresMs.length < p && desistenciaParticipantes.length < p) return false;
    for (let i = 0; i < p; i += 1) {
      if (!completo(i)) return false;
    }
    return true;
  }, [
    tipoProva,
    nParticipantesConfirmado,
    nColunasVoltas,
    temposMilitaresMs,
    desistenciaParticipantes,
  ]);

  /** Quando o último militar recebe tempo, encerra o cronômetro automaticamente. */
  useEffect(() => {
    if (!todosIntegrantesComTempoRegistrado) return;
    if (cronometroEstado !== 'rodando' && cronometroEstado !== 'pausado') return;
    stopwatch.parar();
  }, [todosIntegrantesComTempoRegistrado, cronometroEstado, stopwatch.parar]);

  /**
   * Se o aplicador desmarca o último checklist após “Aplicar Resultado”,
   * o cronômetro volta pausado (e piscando) no instante em que tinha parado.
   */
  const tinhaTodosComTempoRef = useRef(false);
  useEffect(() => {
    const tinhaTodos = tinhaTodosComTempoRef.current;
    tinhaTodosComTempoRef.current = todosIntegrantesComTempoRegistrado;
    if (!tinhaTodos || todosIntegrantesComTempoRegistrado) return;
    if (cronometroEstado !== 'finalizado') return;
    stopwatch.reativarComoPausado();
  }, [
    todosIntegrantesComTempoRegistrado,
    cronometroEstado,
    stopwatch.reativarComoPausado,
  ]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida' || !isProvaComVoltas(tipoProva)) return;
    dispatchTrial({
      type: 'resizeChecksGrid',
      p: nParticipantesConfirmado,
      v: nColunasVoltas,
    });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado, nColunasVoltas]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida') return;
    if (tipoProva !== 'natacao' && tipoProva !== 'abdominal_prancha') return;
    dispatchTrial({ type: 'resizeChegadaNatacao', p: nParticipantesConfirmado });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida' && corridaEtapa !== 'tabela_permanencia') return;
    dispatchTrial({ type: 'resizeTempos', p: nParticipantesConfirmado });
  }, [corridaEtapa, nParticipantesConfirmado]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida') return;
    if (tipoProva !== 'corrida' && tipoProva !== 'natacao') return;
    dispatchTrial({ type: 'resizeDesistencia', p: nParticipantesConfirmado });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado]);

  const toggleCheckVolta = useCallback(
    (participante: number, volta: number) => {
      // Sempre envia o elapsed: um clique “à frente” pode completar a última volta em ordem.
      dispatchTrial({
        type: 'toggleVoltaCorrida',
        participante,
        volta,
        elapsedMs: getElapsedRaceMs(),
      });
    },
    [getElapsedRaceMs],
  );

  const toggleMarcarChegadaNatacao = useCallback(
    (participante: number) => {
      /** Instantâneo no clique (estado atual do cronômetro). */
      const elapsedMs = getElapsedRaceMs();
      dispatchTrial({
        type: 'toggleNatacaoChegada',
        participante,
        elapsedMs,
      });
    },
    [getElapsedRaceMs],
  );

  const confirmarDesistenciaParticipante = useCallback((participante: number) => {
    dispatchTrial({
      type: 'setDesistencia',
      participante,
      value: true,
      elapsedMs: getElapsedRaceMs(),
    });
  }, [getElapsedRaceMs]);

  const limparDesistenciaParticipante = useCallback((participante: number) => {
    dispatchTrial({ type: 'setDesistencia', participante, value: false });
  }, []);

  const limparBufferAplicacao = useCallback(() => {
    pendingCadastrosRef.current = [];
    pendingCleanupsRef.current = [];
    resultadosPosMilitaresRef.current = null;
    sessaoAplicacaoIdRef.current = null;
  }, []);

  const montarSnapshotProvaAtiva = useCallback((): ProvaAtivaSessionV1 | null => {
    if (modoPreCadastro || !mostrarProvas || !tipoProva) return null;
    const emTabela =
      corridaEtapa === 'tabela_corrida' ||
      corridaEtapa === 'tabela_permanencia' ||
      corridaEtapa === 'tabela_repeticoes';
    const emFinalizacao =
      modalRubricaNatacaoVisible || fluxoAplicadorVisible || modalTempoRegistradoVisible;
    if (!emTabela && !emFinalizacao) return null;
    if (nipsParticipantes.length < 1) return null;

    const elapsedMs = getElapsedRaceMs() ?? 0;
    let finalizacao: ProvaAtivaSessionV1['finalizacao'];
    const resultadosPendentes =
      pendingResultadosNavRef.current ??
      resultadosPosMilitaresRef.current ??
      listaResultadosRubricaNatacao;
    const sessaoAplicacaoId = sessaoAplicacaoIdRef.current ?? undefined;
    if (fluxoAplicadorVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'aplicador',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
        sessaoAplicacaoId,
      };
    } else if (modalRubricaNatacaoVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'rubrica_candidatos',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
        sessaoAplicacaoId,
        indiceRubrica: indiceRubricaNatacao,
        listaResultadosRubrica: (pendingResultadosNavRef.current ?? resultadosPendentes).map(
          (r) => ({ ...r }),
        ),
      };
    } else if (modalTempoRegistradoVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'tempo_registrado',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
        sessaoAplicacaoId,
      };
    }

    const etapaSalva: ProvaAtivaSessionV1['corridaEtapa'] = emTabela
      ? corridaEtapa
      : 'nips';

    return {
      v: 1,
      savedAt: Date.now(),
      tipoProva,
      modoTafNaval,
      corridaEtapa: etapaSalva,
      nipsParticipantes: [...nipsParticipantes],
      nipFeedbackLinhas: nipFeedbackLinhas.map((fb) =>
        fb == null ? null : ({ ...fb } as ProvaAtivaSessionV1['nipFeedbackLinhas'][number]),
      ),
      trialTable: {
        checksVoltas: trialTable.checksVoltas.map((row) => [...row]),
        chegadaNatacao: [...trialTable.chegadaNatacao],
        temposMilitaresMs: [...trialTable.temposMilitaresMs],
        desistenciaParticipantes: [...trialTable.desistenciaParticipantes],
        desistenciaVoltasParticipantes: [...(trialTable.desistenciaVoltasParticipantes ?? [])],
        marcacoesOrdem: [...(trialTable.marcacoesOrdem ?? [])],
      },
      numeroVoltas,
      voltasConfirmadas: voltasConfirmadasProva,
      repeticoesParticipantes: [...repeticoesParticipantes],
      resultadoPermanenciaLinhas: [...resultadoPermanenciaLinhas],
      cronometro: {
        estado: cronometroEstado,
        elapsedMs,
        wallClockAtSave: Date.now(),
      },
      nipsRepeticaoAutorizada: [...nipsRepeticaoAutorizadaRef.current],
      preCadastroOrigemId: preCadastroOrigemIdRef.current ?? undefined,
      finalizacao,
    };
  }, [
    modoPreCadastro,
    mostrarProvas,
    tipoProva,
    corridaEtapa,
    modalRubricaNatacaoVisible,
    fluxoAplicadorVisible,
    modalTempoRegistradoVisible,
    nipsParticipantes,
    nipFeedbackLinhas,
    trialTable,
    numeroVoltas,
    voltasConfirmadasProva,
    repeticoesParticipantes,
    resultadoPermanenciaLinhas,
    cronometroEstado,
    getElapsedRaceMs,
    listaResultadosRubricaNatacao,
    indiceRubricaNatacao,
    modoTafNaval,
  ]);

  const persistirProvaAtivaAgora = useCallback(() => {
    if (suppressPersistProvaRef.current) return;
    const snap = montarSnapshotProvaAtiva();
    if (!snap) return;
    void saveProvaAtivaSession(snap);
  }, [montarSnapshotProvaAtiva]);

  const limparSessaoProvaAtiva = useCallback(() => {
    void clearProvaAtivaSession();
  }, []);

  const aplicarSessaoProvaAtiva = useCallback(
    (session: ProvaAtivaSessionV1) => {
      suppressPersistProvaRef.current = true;
      const tipo = session.tipoProva;
      tipoProvaRef.current = tipo;
      setTipoProva(tipo);
      setModoTafNaval(session.modoTafNaval);
      setModoPreCadastro(false);
      setMostrarListaPreCadastro(false);
      setMostrarFatoresRisco(false);
      setMostrarRestritos(false);
      setMostrarProvas(true);
      setNipsParticipantes(session.nipsParticipantes);
      setNipFeedbackLinhas(session.nipFeedbackLinhas as NipFeedbackLinha[]);
      nipsRepeticaoAutorizadaRef.current = new Set(session.nipsRepeticaoAutorizada ?? []);
      preCadastroOrigemIdRef.current = session.preCadastroOrigemId?.trim() || null;
      setModalTesteExistente(null);
      setNumeroVoltas(session.numeroVoltas?.trim() ? session.numeroVoltas : NUMERO_VOLTAS_PADRAO);
      setVoltasConfirmadasProva(Boolean(session.voltasConfirmadas));
      setRepeticoesParticipantes(session.repeticoesParticipantes ?? []);
      setResultadoPermanenciaLinhas(session.resultadoPermanenciaLinhas ?? []);
      setModalPermanenciaFinalizadaVisible(false);
      setErroPermanencia('');
      dispatchTrial({ type: 'hydrate', state: session.trialTable });

      const elapsed = resolveCronometroElapsedMs(session);
      stopwatch.restaurar({
        estado: session.cronometro.estado,
        elapsedMs: elapsed,
      });

      setCorridaEtapa(session.corridaEtapa);

      const fin = session.finalizacao;
      if (fin) {
        pendingCadastrosRef.current = fin.pendingCadastros.map((c) => ({ ...c }));
        pendingCleanupsRef.current = [];
        sessaoAplicacaoIdRef.current = fin.sessaoAplicacaoId?.trim() || null;
        const resultados = fin.resultados.map((r) => ({ ...r }));
        resultadosPosMilitaresRef.current = resultados;
        pendingResultadosNavRef.current = resultados;
        if (fin.fase === 'rubrica_candidatos') {
          const lista = (fin.listaResultadosRubrica ?? resultados).map((r) => ({ ...r }));
          rubricasSvgRef.current = lista.map((r) => (r.rubricaCandidatoSvg || '').trim());
          setListaResultadosRubricaNatacao(lista);
          pendingResultadosNavRef.current = lista;
          setIndiceRubricaNatacao(fin.indiceRubrica ?? 0);
          setErroRubricaNatacao('');
          limparRubricaDraw();
          setModalRubricaNatacaoVisible(true);
          setFluxoAplicadorVisible(false);
          setModalTempoRegistradoVisible(false);
        } else if (fin.fase === 'aplicador') {
          rubricasSvgRef.current = [];
          setListaResultadosRubricaNatacao(null);
          setModalRubricaNatacaoVisible(false);
          setModalTempoRegistradoVisible(false);
          setFluxoAplicadorVisible(true);
        } else {
          setListaResultadosRubricaNatacao(null);
          setModalRubricaNatacaoVisible(false);
          setFluxoAplicadorVisible(false);
          setModalTempoRegistradoVisible(true);
        }
      } else {
        limparBufferAplicacao();
        setListaResultadosRubricaNatacao(null);
        setModalRubricaNatacaoVisible(false);
        setFluxoAplicadorVisible(false);
        setModalTempoRegistradoVisible(false);
      }

      // Modal só no cold start; remount/troca de aba restaura em silêncio.
      if (shouldOfferContinuidadeModal()) {
        markContinuidadeModalOffered();
        setContinuidadeProvaMeta({
          provaLabel: tituloProvaTaf(tipo, session.modoTafNaval),
          participantesCount: session.nipsParticipantes.length,
        });
        setContinuidadeProvaVisible(true);
      } else {
        setContinuidadeProvaVisible(false);
      }

      requestAnimationFrame(() => {
        suppressPersistProvaRef.current = false;
        void saveProvaAtivaSession({
          ...session,
          savedAt: Date.now(),
          cronometro: {
            ...session.cronometro,
            estado: session.cronometro.estado === 'rodando' ? 'pausado' : session.cronometro.estado,
            elapsedMs: elapsed,
            wallClockAtSave: Date.now(),
          },
        });
      });
    },
    [stopwatch.restaurar, limparBufferAplicacao, limparRubricaDraw],
  );

  const descartarSessaoProvaAtivaRestaurada = useCallback(() => {
    suppressPersistProvaRef.current = true;
    setContinuidadeProvaVisible(false);
    setContinuidadeProvaMeta(null);
    limparBufferAplicacao();
    setListaResultadosRubricaNatacao(null);
    rubricasSvgRef.current = [];
    setModalRubricaNatacaoVisible(false);
    setFluxoAplicadorVisible(false);
    setModalTempoRegistradoVisible(false);
    resetCronometroCorrida();
    dispatchTrial({ type: 'resetAll' });
    setRepeticoesParticipantes([]);
    setResultadoPermanenciaLinhas([]);
    setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
    setVoltasConfirmadasProva(false);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    setTipoProva(null);
    tipoProvaRef.current = null;
    preCadastroOrigemIdRef.current = null;
    setModoTafNaval(false);
    setModoPreCadastro(false);
    setMostrarProvas(false);
    setCorridaEtapa('menu');
    void clearProvaAtivaSession();
    requestAnimationFrame(() => {
      suppressPersistProvaRef.current = false;
    });
  }, [limparBufferAplicacao, resetCronometroCorrida]);

  useEffect(() => {
    if (provaAtivaRestauradaRef.current) return;
    provaAtivaRestauradaRef.current = true;
    let cancelled = false;
    void loadProvaAtivaSession().then((session) => {
      if (cancelled || !session) return;
      aplicarSessaoProvaAtiva(session);
    });
    return () => {
      cancelled = true;
    };
  }, [aplicarSessaoProvaAtiva]);

  useEffect(() => {
    if (suppressPersistProvaRef.current) return;
    const snap = montarSnapshotProvaAtiva();
    if (!snap) return;
    const timer = setTimeout(() => {
      void saveProvaAtivaSession(snap);
    }, 350);
    return () => clearTimeout(timer);
  }, [montarSnapshotProvaAtiva]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        persistirProvaAtivaAgora();
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        persistirProvaAtivaAgora();
      }
    };
    const onPageHide = () => {
      persistirProvaAtivaAgora();
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', onPageHide);
    }
    return () => {
      sub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
      }
    };
  }, [persistirProvaAtivaAgora]);

  const gravarSessaoAplicacao = useCallback(
    async (
      resultados: ResultadoCorridaItem[],
      assinatura?: AplicadorAssinaturaResumo,
    ): Promise<string | undefined> => {
      const tipo = tipoProvaRef.current ?? tipoProva;
      if (!tipo || resultados.length === 0) return undefined;

      const emDemonstracao = isModoDemonstracaoAtivo();
      const indicesRepeticao = nipsRepeticaoAutorizadaRef.current;
      if (indicesRepeticao.size > 0 && !emDemonstracao) {
        for (const i of indicesRepeticao) {
          const nip = (resultados[i]?.nip ?? nipsParticipantes[i] ?? '').trim();
          if (nip) {
            await removerParticipanteModalidadeDoHistorico(nip, tipo);
          }
        }
        nipsRepeticaoAutorizadaRef.current = new Set();
      }

      return addSessaoAplicacao({
        ...(emDemonstracao ? { id: `demo-sess-${Date.now()}` } : {}),
        dataAplicacao: dataHojeBr(),
        tipoProva: tipo,
        resultados,
        normaTaf: modoTafNaval ? 'cfn' : 'armada',
        aplicadorAssinatura: assinatura,
      });
    },
    [tipoProva, nipsParticipantes, modoTafNaval],
  );

  /**
   * Grava cadastros + sessão no ato do “Aplicar Resultado” (ainda sem rúbricas).
   * No Modo Teste: só a sessão (demo-sess-*), sem alterar cadastros reais.
   */
  const persistirLancamentoAplicacao = useCallback(
    async (resultados: ResultadoCorridaItem[]): Promise<string | undefined> => {
      const emDemonstracao = isModoDemonstracaoAtivo();

      if (!emDemonstracao) {
        for (const cleanup of pendingCleanupsRef.current) {
          try {
            await cleanup();
          } catch {
            // Limpeza de histórico é complementar; não deve impedir o lançamento.
          }
        }
        pendingCleanupsRef.current = [];

        for (const cadastro of pendingCadastrosRef.current) {
          await addCadastro(cadastro);
        }
        pendingCadastrosRef.current = [];
      } else {
        pendingCleanupsRef.current = [];
        pendingCadastrosRef.current = [];
      }

      const id = await gravarSessaoAplicacao(resultados);
      sessaoAplicacaoIdRef.current = id ?? null;
      return id;
    },
    [gravarSessaoAplicacao],
  );

  /** Atualiza a sessão já lançada (rúbricas dos militares e/ou assinatura do aplicador). */
  const atualizarSessaoEmAndamento = useCallback(
    async (
      resultados: ResultadoCorridaItem[],
      assinatura?: AplicadorAssinaturaResumo,
    ): Promise<void> => {
      const id = sessaoAplicacaoIdRef.current;
      if (!id) return;
      const sessao = await getSessaoAplicacaoById(id);
      if (!sessao) return;
      await updateSessaoAplicacao({
        ...sessao,
        resultados,
        ...(assinatura ? { aplicadorAssinatura: assinatura } : {}),
      });
    },
    [],
  );

  const finalizarFluxoAposSalvo = useCallback(
    async (
      resultados: ResultadoCorridaItem[] | null,
      assinatura?: AplicadorAssinaturaResumo,
    ) => {
      const preCadastroId = preCadastroOrigemIdRef.current;
      preCadastroOrigemIdRef.current = null;
      if (preCadastroId) {
        try {
          await removePreCadastroTaf(preCadastroId);
          const lista = await getAllPreCadastrosTaf();
          setListaPreCadastros(lista);
        } catch {
          // Lançamento já concluído; falha ao limpar pré-cadastro não bloqueia o fluxo.
        }
      }
      limparBufferAplicacao();
      limparSessaoProvaAtiva();
      setFluxoAplicadorVisible(false);
      if (resultados) {
        navigation.navigate('CadastrarResultados', {
          resultados,
          ...(assinatura ? { aplicadorAssinatura: assinatura } : {}),
          returnTo: 'AplicarTAF',
        });
      }
    },
    [navigation, limparBufferAplicacao, limparSessaoProvaAtiva],
  );

  const enqueueRasterLoteRubricasCandidatos = useCallback(
    (resultadosSnap?: ResultadoCorridaItem[]) => {
      const geracao = rubricaPersistGeracaoRef.current;
      const baseSnapshot = (
        resultadosSnap ??
        pendingResultadosNavRef.current ??
        resultadosPosMilitaresRef.current
      )?.map((r) => ({ ...r }));
      const sessaoIdSnapshot = sessaoAplicacaoIdRef.current;

      rubricaPersistChainRef.current = rubricaPersistChainRef.current
        .then(async () => {
          if (rubricaPersistGeracaoRef.current !== geracao) return;

          const base =
            pendingResultadosNavRef.current ??
            resultadosPosMilitaresRef.current ??
            baseSnapshot;
          if (!base?.length) return;

          let lista = base.map((r) => ({ ...r }));
          let rasterizados = 0;

          await yieldToUiHeavy();

          for (let i = 0; i < lista.length; i++) {
            if (rubricaPersistGeracaoRef.current !== geracao) return;
            const item = lista[i];
            if (!item) continue;
            const bruto = (item.rubricaCandidatoSvg || '').trim();
            if (!bruto || isRubricaRasterDataUrl(bruto) || !isRubricaSvgDataUrl(bruto)) {
              continue;
            }

            const raster = (await rubricaParaPersistenciaAsync(bruto))?.trim();
            if (raster && raster !== bruto) {
              lista[i] = {
                ...item,
                rubricaCandidato: 'Rúbrica capturada',
                rubricaCandidatoSvg: raster,
              };
            }
            rasterizados += 1;
            await yieldEveryN(rasterizados, RUBRICA_LOTE_YIELD_A_CADA);
          }

          if (rubricaPersistGeracaoRef.current !== geracao) return;

          if (pendingResultadosNavRef.current) {
            pendingResultadosNavRef.current = lista;
          }
          if (resultadosPosMilitaresRef.current) {
            resultadosPosMilitaresRef.current = lista;
          }

          // Um único lote IDB no fim (SVG restantes ou WebP) — sem write por militar no meio.
          const paraCadastro = lista.filter((r) => (r.rubricaCandidatoSvg || '').trim());
          if (!isModoDemonstracaoAtivo() && paraCadastro.length > 0) {
            await yieldToUiHeavy();
            await persistirRubricasNoCadastro(paraCadastro, { manterSvgBruto: true });
            await yieldToUiHeavy();
          }

          // Se o chefe já concluiu (sessão liberada na UI), espelha rúbricas na sessão.
          const sessaoId = sessaoAplicacaoIdRef.current ?? sessaoIdSnapshot;
          if (sessaoId) {
            try {
              const sessao = await getSessaoAplicacaoById(sessaoId);
              if (sessao) {
                const porNip = new Map(
                  lista.map((r) => [(r.nip || '').replace(/\D/g, ''), r] as const),
                );
                const resultados = sessao.resultados.map((r) => {
                  const chave = (r.nip || '').replace(/\D/g, '');
                  const upd = chave ? porNip.get(chave) : undefined;
                  const svg = (upd?.rubricaCandidatoSvg || '').trim();
                  if (!svg) return r;
                  return {
                    ...r,
                    rubricaCandidato: 'Rúbrica capturada',
                    rubricaCandidatoSvg: svg,
                  };
                });
                await updateSessaoAplicacao({ ...sessao, resultados });
              }
            } catch {
              // Cadastro já gravado; falha ao espelhar na sessão não bloqueia.
            }
          }
        })
        .catch(() => {
          // Falha no lote não bloqueia o fluxo do chefe (refs já têm as rúbricas).
        });
    },
    [],
  );

  const iniciarFinalizacaoComAssinaturaAplicador = useCallback(
    (resultados: ResultadoCorridaItem[]) => {
      resultadosPosMilitaresRef.current = resultados;
      pendingResultadosNavRef.current = resultados;
      setFluxoAplicadorVisible(true);
      // Raster em lote enquanto o chefe assina — não bloqueia a abertura do modal.
      enqueueRasterLoteRubricasCandidatos(resultados);
    },
    [enqueueRasterLoteRubricasCandidatos],
  );

  const onConcluirAssinaturaAplicador = useCallback(
    async (assinatura: AplicadorAssinaturaResumo) => {
      // Não espera SVG/WebP: UI libera na hora; lote segue em background.
      const res =
        pendingResultadosNavRef.current ?? resultadosPosMilitaresRef.current;
      try {
        if (res) {
          await atualizarSessaoEmAndamento(res, assinatura);
        }
      } catch {
        Alert.alert(
          'Erro ao salvar assinatura',
          'Os resultados já estão salvos, mas não foi possível anexar a rúbrica do aplicador. Tente novamente.',
        );
        return;
      }
      // Mantém snapshot nos refs só se o lote ainda precisar; finalizar limpa buffers.
      await finalizarFluxoAposSalvo(res, assinatura);
    },
    [atualizarSessaoEmAndamento, finalizarFluxoAposSalvo],
  );

  const onCancelarAssinaturaAplicador = useCallback(() => {
    const res = pendingResultadosNavRef.current ?? resultadosPosMilitaresRef.current;
    pendingResultadosNavRef.current = null;
    void finalizarFluxoAposSalvo(res);
  }, [finalizarFluxoAposSalvo]);

  /**
   * Abre o modal de rúbrica do candidato sem sair da etapa `tabela_*`.
   * Assim, se a abertura falhar, o modal da prova continua acessível
   * (visível quando `modalRubricaNatacaoVisible` volta a false).
   */
  const abrirFluxoRubricaCandidatos = useCallback(
    (resultados: ResultadoCorridaItem[], avisoParcial: string | null) => {
      if (resultados.length === 0) {
        aplicandoResultadoLockRef.current = false;
        setSalvandoResultadosCorrida(false);
        return;
      }
      rubricaPersistGeracaoRef.current += 1;
      rubricaPersistChainRef.current = Promise.resolve();
      setModalParcialAviso(avisoParcial);
      rubricasSvgRef.current = Array.from({ length: resultados.length }, () => '');
      setIndiceRubricaNatacao(0);
      setErroRubricaNatacao('');
      limparRubricaDraw();
      const copia = resultados.map((r) => ({ ...r }));
      setListaResultadosRubricaNatacao(copia);
      pendingResultadosNavRef.current = copia;
      // Aguarda o fechamento visual do modal da prova antes de montar a rúbrica
      // (evita portal/Modal nativo “sumirem” no mesmo frame no web).
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          setModalRubricaNatacaoVisible(true);
          setSalvandoResultadosCorrida(false);
          aplicandoResultadoLockRef.current = false;
        });
      });
      // Rede de segurança: se a interação nunca concluir, libera o botão.
      setTimeout(() => {
        if (aplicandoResultadoLockRef.current) {
          setModalRubricaNatacaoVisible(true);
          setSalvandoResultadosCorrida(false);
          aplicandoResultadoLockRef.current = false;
        }
      }, 2500);
    },
    [limparRubricaDraw],
  );

  const cancelarFluxoRubricaCandidatos = useCallback(() => {
    rubricaPersistGeracaoRef.current += 1;
    const res =
      pendingResultadosNavRef.current ??
      listaResultadosRubricaNatacao ??
      resultadosPosMilitaresRef.current;
    setModalRubricaNatacaoVisible(false);
    setIndiceRubricaNatacao(0);
    setListaResultadosRubricaNatacao(null);
    rubricasSvgRef.current = [];
    setErroRubricaNatacao('');
    limparRubricaDraw();
    setModalParcialAviso(null);
    pendingResultadosNavRef.current = res;
    aplicandoResultadoLockRef.current = false;
    setCorridaEtapa('nips');
    // Resultados já foram lançados; seguir para o aplicador (opcional) com o que houver.
    if (res && res.length > 0) {
      iniciarFinalizacaoComAssinaturaAplicador(res);
    }
  }, [iniciarFinalizacaoComAssinaturaAplicador, limparRubricaDraw, listaResultadosRubricaNatacao]);

  const onCadastrarResultados = useCallback(async () => {
    if (aplicandoResultadoLockRef.current || salvandoResultadosCorrida) return;
    if (
      tipoProva !== 'corrida' &&
      tipoProva !== 'natacao' &&
      tipoProva !== 'caminhada' &&
      tipoProva !== 'abdominal_prancha'
    ) {
      Alert.alert(
        'Tipo de prova não definido',
        'Volte ao menu e inicie o TAF escolhendo a prova desejada.',
      );
      return;
    }
    aplicandoResultadoLockRef.current = true;
    setSalvandoResultadosCorrida(true);

    const prova = tipoProva;
    const labelAtletaLocal = labelAtletaProva(prova);

    let cadastrosInicial: CadastroItemPersist[] = [];
    try {
      cadastrosInicial = await getAllCadastros({ includeDemo: true });
    } catch {
      cadastrosInicial = [];
    }
    const listaBusca: CadastroItemPersist[] = [...cadastrosInicial];

    const resultados: ResultadoCorridaItem[] = [];

    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const fb = nipFeedbackLinhas[i];
      const nomeBase =
        fb?.tipo === 'ok'
          ? (fb.nomeMilitar || '').trim() || `${labelAtletaLocal} ${i + 1}`
          : `${labelAtletaLocal} ${i + 1}`;
      const nip = nipsParticipantes[i] ?? '';
      const desistiu =
        (prova === 'corrida' || prova === 'natacao') && desistenciaParticipantes[i] === true;

      if (desistiu) {
        const tempoDesistenciaMs = temposMilitaresMs[i];
        const tempoMod =
          prova === 'natacao' || prova === 'abdominal_prancha' ? 'natacao' : 'corrida';
        // Coluna Tempo: só o cronômetro (situação/nota carregam a desistência).
        const desempenhoDesistencia =
          tempoDesistenciaMs != null
            ? formatMsByModality(tempoMod, tempoDesistenciaMs)
            : undefined;
        const notaDesistencia =
          prova === 'corrida'
            ? formatNotaDesistenciaCorrida(desistenciaVoltasParticipantes[i] ?? 0)
            : 'REPROVADO';
        resultados.push({
          corredor: i + 1,
          nome: nomeBase,
          tempoMs: tempoDesistenciaMs ?? 0,
          nip,
          prova,
          desempenhoTexto: desempenhoDesistencia,
          notaTexto: notaDesistencia,
          noraTexto: notaDesistencia,
          reprovacaoTexto: 'Desistência',
          desistencia: true,
          voltasDesistencia: prova === 'corrida' ? (desistenciaVoltasParticipantes[i] ?? 0) : undefined,
        });
        continue;
      }

      const tempoMs = temposMilitaresMs[i] ?? 0;
      let notaTexto: string | undefined;
      if (fb?.tipo === 'ok' && temposMilitaresMs[i] != null) {
        notaTexto = calcularNotaLinhaTempo(prova, tempoMs, fb, modoTafNaval);
        if (notaTexto === '—') notaTexto = undefined;
      }
      const tempoMod =
        prova === 'natacao' || prova === 'abdominal_prancha' ? 'natacao' : 'corrida';
      const desempenhoTexto =
        temposMilitaresMs[i] != null ? formatMsByModality(tempoMod, temposMilitaresMs[i]!) : undefined;

      resultados.push({
        corredor: i + 1,
        nome: nomeBase,
        tempoMs,
        nip,
        prova,
        desempenhoTexto,
        notaTexto,
        noraTexto: notaTexto,
        reprovacaoTexto: isNotaReprovacaoTexto(notaTexto) ? 'Reprovado' : undefined,
      });
    }

    try {
      const bufferCadastros: CadastroItemPersist[] = [];
      const bufferCleanups: Array<() => Promise<void>> = [];
      const listaAtual: CadastroItemPersist[] = [...listaBusca];
      let ok = 0;
      const naoEncontrados: string[] = [];

      for (const r of resultados) {
        let busca = buscarCadastroPorNomeOuNip(listaAtual, r.nip);
        if (busca.kind !== 'found' && r.nome.trim()) {
          busca = buscarCadastroPorNomeOuNip(listaAtual, r.nome);
        }
        if (busca.kind !== 'found') {
          naoEncontrados.push(r.nome);
          continue;
        }
        const atualizado = r.desistencia && (prova === 'corrida' || prova === 'natacao')
          ? aplicarDesistenciaNoCadastro(busca.cadastro, prova, {
              modoTafNaval,
              voltasCompletas: r.voltasDesistencia,
              tempoMs: r.tempoMs,
            })
          : aplicarResultadoNoCadastro(busca.cadastro, prova, {
              tempoMs: r.tempoMs,
              modoTafNaval,
            });
        if (!modoTafNaval && (prova === 'corrida' || prova === 'caminhada')) {
          const nip = (r.nip ?? '').trim();
          if (nip) {
            bufferCleanups.push(() =>
              removerModalidadeOpostaDistanciaDoHistorico(nip, prova, atualizado),
            );
          }
        }
        bufferCadastros.push(atualizado);
        const idx = listaAtual.findIndex((c) => c.id === busca.cadastro.id);
        if (idx >= 0) listaAtual[idx] = atualizado;
        ok += 1;
      }

      pendingCadastrosRef.current = bufferCadastros;
      pendingCleanupsRef.current = bufferCleanups;
      pendingResultadosNavRef.current = resultados;

      await persistirLancamentoAplicacao(resultados);

      let abriuRubrica = false;
      const avisoParcial =
        naoEncontrados.length > 0
          ? `Registro parcial: não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`
          : null;
      const usaRubrica =
        prova === 'natacao' ||
        prova === 'corrida' ||
        prova === 'caminhada' ||
        prova === 'abdominal_prancha';

      if (ok > 0 && usaRubrica && resultados.length > 0) {
        abriuRubrica = true;
        abrirFluxoRubricaCandidatos(resultados, avisoParcial);
      } else if (ok > 0) {
        setModalParcialAviso(avisoParcial);
        setCorridaEtapa('nips');
        setModalTempoRegistradoVisible(true);
      } else {
        Alert.alert(
          'Resultado salvo parcialmente',
          `A sessão foi gravada, mas não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                void iniciarFinalizacaoComAssinaturaAplicador(resultados);
              },
            },
          ],
        );
      }
      if (!abriuRubrica) {
        setSalvandoResultadosCorrida(false);
        aplicandoResultadoLockRef.current = false;
      }
    } catch {
      pendingResultadosNavRef.current = null;
      limparBufferAplicacao();
      Alert.alert(
        'Erro',
        'Não foi possível gravar os tempos. Verifique se o cadastro está disponível (IndexedDB no navegador).',
      );
      setSalvandoResultadosCorrida(false);
      aplicandoResultadoLockRef.current = false;
    }
  }, [
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    salvandoResultadosCorrida,
    temposMilitaresMs,
    desistenciaParticipantes,
    tipoProva,
    iniciarFinalizacaoComAssinaturaAplicador,
    modoTafNaval,
    abrirFluxoRubricaCandidatos,
    persistirLancamentoAplicacao,
    limparBufferAplicacao,
  ]);
  const onCadastrarRepeticoes = useCallback(async () => {
    if (aplicandoResultadoLockRef.current || salvandoResultadosCorrida) return;
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return;

    aplicandoResultadoLockRef.current = true;
    setSalvandoResultadosCorrida(true);

    const prova = tipoProva;
    const labelAtletaLocal = labelAtletaProva(prova);

    let cadastrosInicial: CadastroItemPersist[] = [];
    try {
      cadastrosInicial = await getAllCadastros({ includeDemo: true });
    } catch {
      cadastrosInicial = [];
    }

    const resultados: ResultadoCorridaItem[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const fb = nipFeedbackLinhas[i];
      const raw = (repeticoesParticipantes[i] ?? '').trim();
      const reps = parseInt(raw, 10);
      const nomeBase =
        fb?.tipo === 'ok'
          ? (fb.nomeMilitar || '').trim() || `${labelAtletaLocal} ${i + 1}`
          : `${labelAtletaLocal} ${i + 1}`;
      let notaTexto: string | undefined;
      if (fb?.tipo === 'ok' && Number.isFinite(reps)) {
        notaTexto = calcularNotaLinhaReps(
          prova as 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
          reps,
          fb,
        );
        if (notaTexto === '—') notaTexto = undefined;
      }
      resultados.push({
        corredor: i + 1,
        nome: nomeBase,
        tempoMs: Number.isFinite(reps) ? reps : 0,
        nip: nipsParticipantes[i] ?? '',
        prova,
        desempenhoTexto: Number.isFinite(reps) ? `${reps} rep.` : undefined,
        notaTexto,
        noraTexto: notaTexto,
        reprovacaoTexto: isNotaReprovacaoTexto(notaTexto) ? 'Reprovado' : undefined,
      });
    }

    try {
      const bufferCadastros: CadastroItemPersist[] = [];
      const listaAtual = [...cadastrosInicial];
      let ok = 0;
      const naoEncontrados: string[] = [];

      for (const r of resultados) {
        let busca = buscarCadastroPorNomeOuNip(listaAtual, r.nip);
        if (busca.kind !== 'found' && r.nome.trim()) {
          busca = buscarCadastroPorNomeOuNip(listaAtual, r.nome);
        }
        if (busca.kind !== 'found') {
          naoEncontrados.push(r.nome);
          continue;
        }
        const reps = r.tempoMs;
        const atualizado = aplicarResultadoNoCadastro(busca.cadastro, prova, {
          repeticoes: reps,
          modoTafNaval: true,
        });
        bufferCadastros.push(atualizado);
        const idx = listaAtual.findIndex((c) => c.id === busca.cadastro.id);
        if (idx >= 0) listaAtual[idx] = atualizado;
        ok += 1;
      }

      pendingCadastrosRef.current = bufferCadastros;
      pendingCleanupsRef.current = [];
      pendingResultadosNavRef.current = resultados;

      await persistirLancamentoAplicacao(resultados);

      if (ok > 0) {
        const avisoParcial =
          naoEncontrados.length > 0
            ? `Registro parcial: não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`
            : null;
        setModalParcialAviso(avisoParcial);
        setCorridaEtapa('nips');
        setModalTempoRegistradoVisible(true);
      } else {
        Alert.alert(
          'Resultado salvo parcialmente',
          `A sessão foi gravada, mas não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                void iniciarFinalizacaoComAssinaturaAplicador(resultados);
              },
            },
          ],
        );
      }
    } catch {
      pendingResultadosNavRef.current = null;
      limparBufferAplicacao();
      Alert.alert('Erro', 'Não foi possível gravar as repetições. Tente novamente.');
    } finally {
      setSalvandoResultadosCorrida(false);
      aplicandoResultadoLockRef.current = false;
    }
  }, [
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    repeticoesParticipantes,
    salvandoResultadosCorrida,
    tipoProva,
    iniciarFinalizacaoComAssinaturaAplicador,
    persistirLancamentoAplicacao,
    limparBufferAplicacao,
  ]);
  const fecharModalTempoRegistrado = useCallback(() => {
    const avisoParcial = modalParcialAviso;
    setModalTempoRegistradoVisible(false);
    setModalParcialAviso(null);
    const res = pendingResultadosNavRef.current;
    pendingResultadosNavRef.current = null;
    if (res) {
      if (avisoParcial) {
        Alert.alert('Registro parcial', avisoParcial);
      }
      void iniciarFinalizacaoComAssinaturaAplicador(res);
    }
  }, [iniciarFinalizacaoComAssinaturaAplicador, modalParcialAviso]);

  const iniciarRubricaStroke = useCallback(
    (event: GestureResponderEvent) => {
      setErroRubricaNatacao('');
      const { locationX, locationY } = event.nativeEvent;
      iniciarRubricaStrokePoint(locationX, locationY);
    },
    [iniciarRubricaStrokePoint],
  );

  const moverRubricaStroke = useCallback(
    (event: GestureResponderEvent) => {
      const { locationX, locationY } = event.nativeEvent;
      moverRubricaStrokePoint(locationX, locationY);
    },
    [moverRubricaStrokePoint],
  );

  /** Checkpoint local das rúbricas SVG (prova ativa + sessão), sem raster/cadastro. */
  const checkpointRubricaSvgLocal = useCallback(
    (lista: ResultadoCorridaItem[]) => {
      pendingResultadosNavRef.current = lista;
      resultadosPosMilitaresRef.current = lista;
      persistirProvaAtivaAgora();
      const sessaoId = sessaoAplicacaoIdRef.current;
      if (!sessaoId || isModoDemonstracaoAtivo()) return;
      void (async () => {
        try {
          await yieldToUiHeavy();
          const atual = pendingResultadosNavRef.current ?? lista;
          await atualizarSessaoEmAndamento(atual);
        } catch {
          // Continuindade via prova ativa já cobre; falha na sessão não bloqueia o fluxo.
        }
      })();
    },
    [atualizarSessaoEmAndamento, persistirProvaAtivaAgora],
  );

  const limparRubricaNatacaoAtual = useCallback(() => {
    setErroRubricaNatacao('');
    limparRubricaDraw();
    const nextSvg = [...rubricasSvgRef.current];
    if (indiceRubricaNatacao < nextSvg.length) nextSvg[indiceRubricaNatacao] = '';
    rubricasSvgRef.current = nextSvg;

    const base = pendingResultadosNavRef.current ?? listaResultadosRubricaNatacao;
    if (!base) return;
    const atualizados = base.map((item, idx) =>
      idx === indiceRubricaNatacao
        ? { ...item, rubricaCandidato: undefined, rubricaCandidatoSvg: undefined }
        : item,
    );
    checkpointRubricaSvgLocal(atualizados);
  }, [
    checkpointRubricaSvgLocal,
    indiceRubricaNatacao,
    limparRubricaDraw,
    listaResultadosRubricaNatacao,
  ]);

  const buildSvgRubricaAtual = useCallback((): string | null => {
    const strokesProntos = getTodosStrokesRubrica();
    if (strokesProntos.length === 0) return null;
    // Só SVG aqui — raster WebP fica em background (não bloqueia “Próximo”).
    return buildRubricaSvgDataUrl(
      strokesProntos,
      rubricaCanvasWidth,
      RUBRICA_NATIVA_ALTURA,
      RUBRICA_COR_TRACO,
      RUBRICA_COR_FUNDO,
    );
  }, [getTodosStrokesRubrica, rubricaCanvasWidth]);

  /** Atualiza só refs — sem setState da lista e sem IDB de cadastro no meio do fluxo. */
  const aplicarSvgNoIndiceRubrica = useCallback(
    (index: number, svg: string, listaBase: ResultadoCorridaItem[]) => {
      const atualizados = listaBase.map((item, idx) =>
        idx === index
          ? { ...item, rubricaCandidato: 'Rúbrica capturada', rubricaCandidatoSvg: svg }
          : item,
      );
      const nextSvg = [...rubricasSvgRef.current];
      while (nextSvg.length < atualizados.length) nextSvg.push('');
      nextSvg[index] = svg;
      rubricasSvgRef.current = nextSvg;
      checkpointRubricaSvgLocal(atualizados);
      return atualizados;
    },
    [checkpointRubricaSvgLocal],
  );

  const irParaRubricaIndex = useCallback(
    (novoIndex: number) => {
      const res = pendingResultadosNavRef.current ?? listaResultadosRubricaNatacao;
      if (!res || novoIndex < 0 || novoIndex >= res.length) return;
      if (novoIndex === indiceRubricaNatacao) return;
      const svgNovo = buildSvgRubricaAtual();
      if (svgNovo) {
        aplicarSvgNoIndiceRubrica(indiceRubricaNatacao, svgNovo, res);
      }
      setIndiceRubricaNatacao(novoIndex);
      setErroRubricaNatacao('');
    },
    [
      aplicarSvgNoIndiceRubrica,
      buildSvgRubricaAtual,
      indiceRubricaNatacao,
      listaResultadosRubricaNatacao,
    ],
  );

  const onVoltarRubricaCandidato = useCallback(() => {
    if (indiceRubricaNatacao <= 0) {
      cancelarFluxoRubricaCandidatos();
      return;
    }
    irParaRubricaIndex(indiceRubricaNatacao - 1);
  }, [cancelarFluxoRubricaCandidatos, indiceRubricaNatacao, irParaRubricaIndex]);

  const confirmarRubricaNatacao = useCallback(() => {
    const res = pendingResultadosNavRef.current ?? listaResultadosRubricaNatacao;
    if (!res || res.length === 0) {
      setModalRubricaNatacaoVisible(false);
      setIndiceRubricaNatacao(0);
      setListaResultadosRubricaNatacao(null);
      rubricasSvgRef.current = [];
      setErroRubricaNatacao('');
      limparRubricaDraw();
      return;
    }
    const svgNovo = buildSvgRubricaAtual();
    const svgExistente =
      (res[indiceRubricaNatacao]?.rubricaCandidatoSvg || '').trim() ||
      (rubricasSvgRef.current[indiceRubricaNatacao] || '').trim();
    if (!svgNovo && !svgExistente) {
      setErroRubricaNatacao('Desenhe a rúbrica do candidato para continuar.');
      return;
    }
    const atualizados = svgNovo
      ? aplicarSvgNoIndiceRubrica(indiceRubricaNatacao, svgNovo, res)
      : res;

    const proximo = indiceRubricaNatacao + 1;
    if (proximo < atualizados.length) {
      // Só índice (+ limpeza do canvas no effect) — sem setState da lista.
      setIndiceRubricaNatacao(proximo);
      setErroRubricaNatacao('');
      return;
    }
    const faltando = atualizados.findIndex((r) => !(r.rubricaCandidatoSvg || '').trim());
    if (faltando >= 0) {
      setIndiceRubricaNatacao(faltando);
      setErroRubricaNatacao('Desenhe a rúbrica de todos os candidatos antes de finalizar.');
      return;
    }
    setModalRubricaNatacaoVisible(false);
    setIndiceRubricaNatacao(0);
    setListaResultadosRubricaNatacao(null);
    rubricasSvgRef.current = [];
    setErroRubricaNatacao('');
    limparRubricaDraw();
    setCorridaEtapa('nips');
    if (modalParcialAviso) {
      Alert.alert('Registro parcial', modalParcialAviso);
    }
    pendingResultadosNavRef.current = atualizados;
    // Abre o chefe no próximo frame — raster + IDB em lote rodam em background ao abrir.
    InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        iniciarFinalizacaoComAssinaturaAplicador(atualizados);
      });
    });
    setModalParcialAviso(null);
  }, [
    aplicarSvgNoIndiceRubrica,
    buildSvgRubricaAtual,
    indiceRubricaNatacao,
    iniciarFinalizacaoComAssinaturaAplicador,
    limparRubricaDraw,
    listaResultadosRubricaNatacao,
    modalParcialAviso,
  ]);

  /** Ao trocar de participante ou abrir o modal: limpa a área de assinatura para não misturar traços. */
  useEffect(() => {
    if (!modalRubricaNatacaoVisible) return;
    limparRubricaDraw();
    setErroRubricaNatacao('');
  }, [indiceRubricaNatacao, limparRubricaDraw, modalRubricaNatacaoVisible]);

  /** Evita scroll da página por trás do modal de assinatura (web / PWA). */
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!modalRubricaNatacaoVisible) return;
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
    };
  }, [modalRubricaNatacaoVisible]);

  const iniciarIdentificacaoNips = useCallback((tipo: TipoProvaTAF) => {
    // Identificação só abre depois de garantir Modo Teste desligado.
    void desativarModoDemonstracaoSeAtivo().then(() => {
      setDemoAtivo(false);
      tipoProvaRef.current = tipo;
      setTipoProva(tipo);
      setErroParticipantes('');
      setNipsParticipantes(['']);
      setNipFeedbackLinhas([null]);
      nipsRepeticaoAutorizadaRef.current = new Set();
      setModalEditarIdadeGeneroIndex(null);
      setParticipanteNipParaExcluir(null);
      setModalCadastroRapido(null);
      setCorridaEtapa('nips');
    });
  }, []);

  const abrirCorrida = useCallback(() => {
    iniciarIdentificacaoNips('corrida');
  }, [iniciarIdentificacaoNips]);

  const abrirNatacao = useCallback(() => {
    iniciarIdentificacaoNips('natacao');
  }, [iniciarIdentificacaoNips]);

  const abrirPermanencia = useCallback(() => {
    iniciarIdentificacaoNips('permanencia');
  }, [iniciarIdentificacaoNips]);

  const abrirCaminhada = useCallback(() => {
    iniciarIdentificacaoNips('caminhada');
  }, [iniciarIdentificacaoNips]);

  const abrirFlexaoBarra = useCallback(() => {
    iniciarIdentificacaoNips('flexao_barra');
  }, [iniciarIdentificacaoNips]);

  const abrirFlexaoSolo = useCallback(() => {
    iniciarIdentificacaoNips('flexao_solo');
  }, [iniciarIdentificacaoNips]);

  const abrirAbdominalRemador = useCallback(() => {
    iniciarIdentificacaoNips('abdominal_remador');
  }, [iniciarIdentificacaoNips]);

  const abrirAbdominalPrancha = useCallback(() => {
    iniciarIdentificacaoNips('abdominal_prancha');
  }, [iniciarIdentificacaoNips]);

  const voltarMenuProvas = useCallback(() => {
    tipoProvaRef.current = null;
    setTipoProva(null);
    setErroParticipantes('');
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalEditarIdadeGeneroIndex(null);
    setParticipanteNipParaExcluir(null);
    setModalCadastroRapido(null);
    setCorridaEtapa('menu');
  }, []);

  const adicionarParticipanteNip = useCallback(() => {
    const limite = modoPreCadastro
      ? limiteParticipantesPreCadastro(tipoProva)
      : MAX_PARTICIPANTES;
    if (nipsParticipantes.length >= limite) {
      setErroParticipantes(
        modoPreCadastro && tipoProva !== 'caminhada'
          ? `Máximo de ${MAX_PRE_CADASTRO_PARTICIPANTES} participantes no pré-cadastro.`
          : `Máximo de ${MAX_PARTICIPANTES} participantes.`,
      );
      return;
    }
    setErroParticipantes('');
    scrollNipsAposAddRef.current = true;
    setNipsParticipantes((prev) => [...prev, '']);
    setNipFeedbackLinhas((prev) => [...prev, null]);
  }, [modoPreCadastro, tipoProva, nipsParticipantes.length]);

  const rolarParaNovoNip = useCallback(() => {
    nipsScrollRef.current?.scrollToEnd({ animated: true });
    // PWA/standalone: ScrollView do RN-web às vezes não move; scrollIntoView no âncora é confiável.
    if (Platform.OS === 'web') {
      const el = nipsFimAnchorRef.current as unknown as {
        scrollIntoView?: (opts?: ScrollIntoViewOptions) => void;
      } | null;
      el?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useLayoutEffect(() => {
    if (!scrollNipsAposAddRef.current) return;
    if (corridaEtapa !== 'nips') {
      scrollNipsAposAddRef.current = false;
      return;
    }

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const raf = requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        rolarParaNovoNip();
        // Layout do novo campo no PWA costuma atrasar mais que no Chrome desktop.
        for (const ms of [50, 160, 320]) {
          timers.push(setTimeout(rolarParaNovoNip, ms));
        }
        timers.push(
          setTimeout(() => {
            scrollNipsAposAddRef.current = false;
          }, 400),
        );
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [nipsParticipantes.length, corridaEtapa, rolarParaNovoNip]);

  const removerParticipanteNip = useCallback((index: number) => {
    setErroParticipantes('');
    setParticipanteNipParaExcluir(null);
    setExclusaoParticipanteOrigem('nips');
    setModalEditarIdadeGeneroIndex((cur) => {
      if (cur == null) return null;
      if (cur === index) return null;
      if (cur > index) return cur - 1;
      return cur;
    });
    setNipsParticipantes((prev) => {
      if (prev.length <= 1) return [''];
      return prev.filter((_, i) => i !== index);
    });
    setNipFeedbackLinhas((prev) => {
      if (prev.length <= 1) return [null];
      return prev.filter((_, i) => i !== index);
    });
    const rep = new Set<number>();
    for (const i of nipsRepeticaoAutorizadaRef.current) {
      if (i === index) continue;
      rep.add(i > index ? i - 1 : i);
    }
    nipsRepeticaoAutorizadaRef.current = rep;
  }, []);

  const solicitarExclusaoParticipanteNip = useCallback((index: number) => {
    setExclusaoParticipanteOrigem('nips');
    setParticipanteNipParaExcluir(index);
  }, []);

  const solicitarExclusaoParticipanteProva = useCallback(
    (index: number) => {
      if (nipsParticipantes.length <= 1) {
        Alert.alert(
          'Não é possível excluir',
          'A prova precisa de ao menos um participante. Volte à identificação para cancelar a prova.',
        );
        return;
      }
      setExclusaoParticipanteOrigem('prova');
      setParticipanteNipParaExcluir(index);
    },
    [nipsParticipantes.length],
  );

  const confirmarExclusaoParticipanteNip = useCallback(() => {
    if (participanteNipParaExcluir == null) return;
    const index = participanteNipParaExcluir;
    if (exclusaoParticipanteOrigem === 'prova') {
      dispatchTrial({ type: 'removeParticipanteAt', index });
      setResultadoPermanenciaLinhas((prev) => prev.filter((_, i) => i !== index));
      setRepeticoesParticipantes((prev) => prev.filter((_, i) => i !== index));
    }
    removerParticipanteNip(index);
  }, [
    participanteNipParaExcluir,
    exclusaoParticipanteOrigem,
    removerParticipanteNip,
  ]);

  const fbExclusaoParticipante =
    participanteNipParaExcluir != null ? nipFeedbackLinhas[participanteNipParaExcluir] : null;
  const nomeExclusaoParticipante =
    fbExclusaoParticipante?.tipo === 'ok' || fbExclusaoParticipante?.tipo === 'completar_dados'
      ? fbExclusaoParticipante.nomeMilitar
      : '';
  const nipExclusaoParticipante =
    participanteNipParaExcluir != null
      ? (nipsParticipantes[participanteNipParaExcluir] ?? '')
      : '';

  const definirNipOk = useCallback((index: number, c: CadastroItemPersist) => {
    const campos = camposCadastroParaFeedback(c);
    setNipFeedbackLinhas((prev) => {
      const next = [...prev];
      next[index] = {
        tipo: 'ok',
        texto: 'Militar Cadastrado no Sistema.',
        ...campos,
      };
      return next;
    });
  }, []);

  const finalizarConfirmacaoNip = useCallback((index: number, c: CadastroItemPersist) => {
    definirNipOk(index, c);
  }, [definirNipOk]);

  const abrirModalExcludenteSeConflito = useCallback(
    (
      index: number,
      c: CadastroItemPersist,
      nipLinha: string,
      sessoes: Awaited<ReturnType<typeof getAllSessoesAplicacao>>,
      cadastros: CadastroItemPersist[],
    ): boolean => {
      const modalidade = tipoProvaRef.current ?? tipoProva;
      const oposta = detectarConflitoCorridaCaminhada(
        modalidade,
        c,
        nipLinha,
        sessoes,
        cadastros,
        modoTafNaval,
      );
      if (!oposta || (modalidade !== 'corrida' && modalidade !== 'caminhada')) return false;

      const nome = formatNomeComPosto({ ...c, nome: (c.nome || '').trim() || 'Sem nome' });
      setModalModalidadeExcludente({
        index,
        nome,
        nip: nipLinha,
        modalidadeExistente: oposta,
        modalidadeNova: modalidade,
        cadastro: c,
      });
      return true;
    },
    [tipoProva, modoTafNaval],
  );

  const limparNipLinha = useCallback((index: number) => {
    setNipsParticipantes((prev) => {
      const next = [...prev];
      next[index] = '';
      return next;
    });
    setNipFeedbackLinhas((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    if (nipsRepeticaoAutorizadaRef.current.has(index)) {
      const rep = new Set(nipsRepeticaoAutorizadaRef.current);
      rep.delete(index);
      nipsRepeticaoAutorizadaRef.current = rep;
    }
  }, []);

  const prosseguirModalidadeExcludente = useCallback(() => {
    if (!modalModalidadeExcludente) return;
    const { index, cadastro } = modalModalidadeExcludente;
    definirNipOk(index, cadastro);
    setModalModalidadeExcludente(null);
  }, [modalModalidadeExcludente, definirNipOk]);

  const desistirModalidadeExcludente = useCallback(() => {
    if (!modalModalidadeExcludente) return;
    limparNipLinha(modalModalidadeExcludente.index);
    setModalModalidadeExcludente(null);
  }, [modalModalidadeExcludente, limparNipLinha]);

  const continuarAposCadastroEncontrado = useCallback(
    async (index: number, c: CadastroItemPersist) => {
      if (
        cadastroPrecisaCompletarDadosTaf(c, {
          exigirVinculo: !isModoDemonstracaoAtivo(),
        })
      ) {
        const campos = camposCadastroParaFeedback(c);
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          next[index] = {
            tipo: 'completar_dados',
            ...campos,
            sexo: c.sexo === 'F' ? 'F' : 'M',
            vinculo: c.vinculo === 'carreira' || c.vinculo === 'rm2' ? c.vinculo : null,
            cadastro: c,
          };
          return next;
        });
        return;
      }

      const nome = formatNomeComPosto({ ...c, nome: (c.nome || '').trim() || 'Sem nome' });
      const nipLinha = nipsParticipantes[index] || c.nip;
      const modalidade = tipoProvaRef.current ?? tipoProva;
      const emDemonstracao = isModoDemonstracaoAtivo();
      const precisaHistorico =
        !emDemonstracao &&
        (modalidade === 'corrida' || modalidade === 'caminhada') &&
        !modoTafNaval;

      let sessoes: Awaited<ReturnType<typeof getAllSessoesAplicacao>> = [];
      let cadastros: CadastroItemPersist[] = [];

      if (
        precisaHistorico ||
        (modalidade && !nipsRepeticaoAutorizadaRef.current.has(index) && !emDemonstracao)
      ) {
        [sessoes, cadastros] = await Promise.all([
          getAllSessoesAplicacao(),
          getAllCadastros({ includeDemo: true }),
        ]);
      }

      if (modalidade && !nipsRepeticaoAutorizadaRef.current.has(index) && !emDemonstracao) {
        const existente = buscarRegistroModalidadeExistente(
          nipLinha,
          modalidade,
          sessoes,
          c,
          cadastros,
        );
        if (existente) {
          setModalTesteExistente({
            index,
            nip: nipLinha,
            nome,
            registro: existente,
            dataNascimento: c.dataNascimento || '',
            sexo: c.sexo,
          });
          return;
        }
      }

      if (
        precisaHistorico &&
        !emDemonstracao &&
        abrirModalExcludenteSeConflito(index, c, nipLinha, sessoes, cadastros)
      ) {
        return;
      }

      finalizarConfirmacaoNip(index, c);
    },
    [nipsParticipantes, tipoProva, modoTafNaval, finalizarConfirmacaoNip, abrirModalExcludenteSeConflito],
  );

  const atualizarDadosNipLinha = useCallback(
    (
      index: number,
      patch: Partial<{
        dataNascimento: string;
        sexo: 'M' | 'F';
        vinculo: 'carreira' | 'rm2' | null;
      }>,
    ) => {
      if (isModoDemonstracaoAtivo()) return;
      setNipFeedbackLinhas((prev) => {
        const fb = prev[index];
        if (fb?.tipo !== 'completar_dados') return prev;
        const next = [...prev];
        next[index] = { ...fb, ...patch, erro: undefined };
        return next;
      });
    },
    [],
  );

  const confirmarDadosNipLinha = useCallback(
    async (index: number) => {
      if (isModoDemonstracaoAtivo()) return;
      const fb = nipFeedbackLinhas[index];
      if (fb?.tipo !== 'completar_dados') return;

      const setErroLinha = (erro: string) => {
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          const cur = prev[index];
          if (cur?.tipo !== 'completar_dados') return prev;
          next[index] = { ...cur, erro };
          return next;
        });
      };

      const dataNasc = fb.dataNascimento.trim();
      if (!dataNascimentoCadastroValida(dataNasc)) {
        setErroLinha('Informe a data de nascimento no formato DD/MM/AAAA.');
        return;
      }

      const vinculoFinal =
        fb.vinculo === 'carreira' || fb.vinculo === 'rm2'
          ? fb.vinculo
          : fb.cadastro.vinculo === 'carreira' || fb.cadastro.vinculo === 'rm2'
            ? fb.cadastro.vinculo
            : null;
      if (!vinculoCadastroValido(vinculoFinal)) {
        setErroLinha('Selecione Carreira ou RM2.');
        return;
      }

      const atualizado: CadastroItemPersist = {
        ...fb.cadastro,
        dataNascimento: dataNasc,
        sexo: fb.sexo,
        vinculo: vinculoFinal,
      };

      try {
        await addCadastro(atualizado);
      } catch {
        setErroLinha('Não foi possível salvar os dados. Tente novamente.');
        return;
      }

      await continuarAposCadastroEncontrado(index, atualizado);
    },
    [nipFeedbackLinhas, continuarAposCadastroEncontrado],
  );

  const salvarEdicaoIdadeGenero = useCallback(
    async (dados: EditarDadosMilitarPayload) => {
      if (isModoDemonstracaoAtivo()) {
        throw new Error('No Modo Teste não é permitido alterar os dados do militar.');
      }
      const index = modalEditarIdadeGeneroIndex;
      if (index == null) return;
      const nipLinha = nipsParticipantes[index] ?? '';
      const lista = await getAllCadastros({ includeDemo: true });
      const busca = buscarCadastroPorNomeOuNip(lista, nipLinha);
      if (busca.kind !== 'found') {
        throw new Error('Militar não encontrado no cadastro.');
      }
      const atualizado: CadastroItemPersist = {
        ...busca.cadastro,
        nome: dados.nome,
        categoria: dados.categoria,
        oficial: dados.categoria === 'Oficiais' ? dados.oficial : undefined,
        praca: dados.categoria === 'Praças' ? dados.praca : undefined,
        dataNascimento: dados.dataNascimento,
        sexo: dados.sexo,
        vinculo: dados.vinculo,
      };
      await addCadastro(atualizado);
      definirNipOk(index, atualizado);
      setModalEditarIdadeGeneroIndex(null);
    },
    [modalEditarIdadeGeneroIndex, nipsParticipantes, definirNipOk],
  );

  const modalEditarFb =
    modalEditarIdadeGeneroIndex != null
      ? nipFeedbackLinhas[modalEditarIdadeGeneroIndex]
      : null;
  const modalEditarOk = modalEditarFb?.tipo === 'ok' ? modalEditarFb : null;

  const atualizarNip = useCallback((index: number, texto: string) => {
    if (isModoDemonstracaoAtivo()) return;
    setNipsParticipantes((prev) => {
      const next = [...prev];
      next[index] = formatNipInput(texto);
      return next;
    });
    setNipFeedbackLinhas((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    if (nipsRepeticaoAutorizadaRef.current.has(index)) {
      const rep = new Set(nipsRepeticaoAutorizadaRef.current);
      rep.delete(index);
      nipsRepeticaoAutorizadaRef.current = rep;
    }
  }, []);

  const verificarNipNoCadastro = useCallback(async (index: number) => {
    const nip = nipsParticipantes[index] || '';
    const digitos = nip.replace(/\D/g, '');
    if (digitos.length !== 8) {
      setNipFeedbackLinhas((prev) => {
        const next = [...prev];
        next[index] = {
          tipo: 'erro',
          texto: 'Informe o NIP completo (8 dígitos).',
        };
        return next;
      });
      return;
    }

    const cadastros = await getAllCadastros({ includeDemo: true });
    const resultado = buscarCadastroPorNomeOuNip(cadastros, nip);

    if (resultado.kind !== 'found') {
      if (resultado.kind === 'none') {
        setModalCadastroRapido({ index, nip });
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          next[index] = null;
          return next;
        });
        return;
      }
      setNipFeedbackLinhas((prev) => {
        const next = [...prev];
        next[index] = {
          tipo: 'erro',
          texto:
            'Vários cadastros correspondem à busca. Informe o NIP completo (8 dígitos).',
        };
        return next;
      });
      return;
    }

    const c = resultado.cadastro;
    await continuarAposCadastroEncontrado(index, c);
  }, [nipsParticipantes, continuarAposCadastroEncontrado]);

  const onMilitarCadastradoRapido = useCallback(
    async (cadastro: CadastroItemPersist) => {
      const ctx = modalCadastroRapido;
      if (!ctx) return;
      const { index } = ctx;
      setNipsParticipantes((prev) => {
        const next = [...prev];
        next[index] = formatNipInput(cadastro.nip);
        return next;
      });
      setModalCadastroRapido(null);
      await continuarAposCadastroEncontrado(index, cadastro);
    },
    [modalCadastroRapido, continuarAposCadastroEncontrado],
  );

  const preencherNipsDemonstracao = useCallback(
    async (quantidade: number) => {
      if (preenchendoNipsDemo) return;
      const n = Math.max(1, Math.floor(quantidade));
      setPreenchendoNipsDemo(true);
      try {
        const cadastros = await getAllCadastros({ includeDemo: true });
        const pool = filtrarCadastrosDemonstracao(cadastros, modoTafNaval);
        if (pool.length < n) {
          throw new Error(
            `Há apenas ${pool.length} militar(es) de exemplo disponível(is) para esta prova. Informe no máximo ${pool.length}.`,
          );
        }
        const selecionados = pool.slice(0, n);
        setErroParticipantes('');
        setNipsParticipantes(selecionados.map((c) => c.nip));
        setNipFeedbackLinhas(selecionados.map((c) => nipFeedbackOkFromCadastro(c)));
        nipsRepeticaoAutorizadaRef.current = new Set(Array.from({ length: n }, (_, i) => i));
        setModalTesteExistente(null);
        setModalModalidadeExcludente(null);
      } finally {
        setPreenchendoNipsDemo(false);
      }
    },
    [modoTafNaval, preenchendoNipsDemo],
  );

  /** Limpa NIPs da etapa atual ao desativar o Modo Teste. */
  const limparNipsDemonstracao = useCallback(() => {
    const n = nParticipantesConfirmado;
    if (n < 1) return;
    setNipsParticipantes(Array.from({ length: n }, () => ''));
    setNipFeedbackLinhas(Array.from({ length: n }, () => null));
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setModalModalidadeExcludente(null);
  }, [nParticipantesConfirmado]);

  const fecharModalTesteExistente = useCallback(() => {
    setModalTesteExistente(null);
  }, []);

  const confirmarRepeticaoTeste = useCallback(async () => {
    if (!modalTesteExistente) return;
    const { index, nip } = modalTesteExistente;
    nipsRepeticaoAutorizadaRef.current.add(index);
    const cadastros = await getAllCadastros({ includeDemo: true });
    const busca = buscarCadastroPorNomeOuNip(cadastros, nip);
    if (busca.kind === 'found') {
      definirNipOk(index, busca.cadastro);
    }
    setModalTesteExistente(null);
  }, [modalTesteExistente, definirNipOk]);

  const validarNipsConfirmados = useCallback((): boolean => {
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (OK em cada linha) e preencha data de nascimento e gênero quando solicitado.',
        );
        return false;
      }
    }
    return true;
  }, [nParticipantesConfirmado, nipFeedbackLinhas]);

  const executarPrepararProvaTempo = useCallback(() => {
    if (
      tipoProva !== 'corrida' &&
      tipoProva !== 'natacao' &&
      tipoProva !== 'caminhada' &&
      tipoProva !== 'abdominal_prancha'
    ) {
      Alert.alert(
        'Tipo de prova não definido',
        'Volte ao menu e escolha a prova antes de continuar.',
      );
      return;
    }
    resetCronometroCorrida();
    setVoltasConfirmadasProva(false);
    dispatchTrial({
      type: 'prepararProva',
      nParticipantes: nParticipantesConfirmado,
      tipoProva: trialTipoFromProva(tipoProva),
    });
    setCorridaEtapa('tabela_corrida');
  }, [resetCronometroCorrida, nParticipantesConfirmado, tipoProva]);

  const executarPrepararProvaRepeticoes = useCallback(() => {
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return;
    setVoltasConfirmadasProva(false);
    setRepeticoesParticipantes(Array.from({ length: nParticipantesConfirmado }, () => ''));
    setCorridaEtapa('tabela_repeticoes');
  }, [nParticipantesConfirmado, tipoProva]);

  const executarPrepararPermanencia = useCallback(() => {
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    setVoltasConfirmadasProva(false);
    setResultadoPermanenciaLinhas(
      Array.from({ length: nParticipantesConfirmado }, () => null),
    );
    resetCronometroCorrida();
    dispatchTrial({
      type: 'hydrate',
      state: {
        checksVoltas: [],
        chegadaNatacao: [],
        temposMilitaresMs: Array.from({ length: nParticipantesConfirmado }, () => null),
        desistenciaParticipantes: [],
        desistenciaVoltasParticipantes: [],
        marcacoesOrdem: [],
      },
    });
    setCorridaEtapa('tabela_permanencia');
  }, [nParticipantesConfirmado, resetCronometroCorrida]);

  const prepararProva = useCallback(() => {
    if (
      tipoProva !== 'corrida' &&
      tipoProva !== 'natacao' &&
      tipoProva !== 'caminhada' &&
      tipoProva !== 'abdominal_prancha'
    ) {
      Alert.alert(
        'Tipo de prova não definido',
        'Volte ao menu e escolha a prova antes de continuar.',
      );
      return;
    }
    if (!validarNipsConfirmados()) return;
    executarPrepararProvaTempo();
  }, [tipoProva, validarNipsConfirmados, executarPrepararProvaTempo]);

  const prepararProvaRepeticoes = useCallback(() => {
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return;
    if (!validarNipsConfirmados()) return;
    executarPrepararProvaRepeticoes();
  }, [tipoProva, validarNipsConfirmados, executarPrepararProvaRepeticoes]);

  const prepararPermanencia = useCallback(() => {
    if (!validarNipsConfirmados()) return;
    executarPrepararPermanencia();
  }, [validarNipsConfirmados, executarPrepararPermanencia]);

  const togglePermanenciaResultado = useCallback(
    (index: number, opcao: 'aprovado' | 'reprovado') => {
      setErroPermanencia('');
      const atual = resultadoPermanenciaLinhas[index] ?? null;
      const clearing = atual === opcao;
      const nextOp: ResultadoPermanenciaOpcao = clearing ? null : opcao;

      setResultadoPermanenciaLinhas((prev) => {
        const next = [...prev];
        while (next.length <= index) next.push(null);
        next[index] = nextOp;
        return next;
      });

      dispatchTrial({
        type: 'syncMarcacaoPermanencia',
        participante: index,
        opcao: nextOp,
      });

      // Aprovado → 10:00 fixos; reprovado → tempo atual do cronômetro; desmarcar → limpa.
      const tempoMs =
        nextOp == null
          ? null
          : nextOp === 'aprovado'
            ? PERMANENCIA_DURACAO_MS
            : (getElapsedRaceMs() ?? 0);

      dispatchTrial({
        type: 'setTempoParticipante',
        participante: index,
        elapsedMs: tempoMs,
      });
    },
    [resultadoPermanenciaLinhas, getElapsedRaceMs],
  );

  const onCadastrarPermanencia = useCallback(async () => {
    if (aplicandoResultadoLockRef.current || salvandoResultadosCorrida) return;
    const faltam = resultadoPermanenciaLinhas.findIndex(
      (r) => r !== 'aprovado' && r !== 'reprovado',
    );
    if (faltam >= 0) {
      setErroPermanencia('Marque Aprovado ou Reprovado para todos os participantes.');
      return;
    }
    setErroPermanencia('');
    aplicandoResultadoLockRef.current = true;
    setSalvandoResultadosCorrida(true);

    try {
      let cadastrosInicial: CadastroItemPersist[] = [];
      try {
        cadastrosInicial = await getAllCadastros({ includeDemo: true });
      } catch {
        cadastrosInicial = [];
      }
      const bufferCadastros: CadastroItemPersist[] = [];
      const listaAtual = [...cadastrosInicial];
      let ok = 0;
      const naoEncontrados: string[] = [];

      const tempoMsLinha = (i: number, resultado: 'aprovado' | 'reprovado'): number => {
        const gravado = temposMilitaresMs[i];
        if (gravado != null && Number.isFinite(gravado) && gravado >= 0) return gravado;
        return resultado === 'aprovado'
          ? PERMANENCIA_DURACAO_MS
          : (tempoParadoMsRef.current ?? getElapsedRaceMs() ?? 0);
      };

      const resultadosPerm: ResultadoCorridaItem[] = [];
      for (let i = 0; i < nParticipantesConfirmado; i += 1) {
        const fb = nipFeedbackLinhas[i];
        const nip = nipsParticipantes[i] ?? '';
        const resultado = resultadoPermanenciaLinhas[i]!;
        const tempoMs = tempoMsLinha(i, resultado);
        resultadosPerm.push({
          corredor: i + 1,
          nome:
            fb?.tipo === 'ok'
              ? (fb.nomeMilitar || '').trim() || `Militar ${i + 1}`
              : `Militar ${i + 1}`,
          nip,
          tempoMs,
          prova: 'permanencia',
          notaTexto: resultado === 'aprovado' ? 'Aprovado' : 'REPROVADO',
          reprovacaoTexto: resultado === 'reprovado' ? 'Reprovado' : undefined,
        });
      }

      for (let i = 0; i < nParticipantesConfirmado; i += 1) {
        const nip = nipsParticipantes[i] ?? '';
        let busca = buscarCadastroPorNomeOuNip(listaAtual, nip);
        const fb = nipFeedbackLinhas[i];
        if (busca.kind !== 'found' && fb?.tipo === 'ok' && fb.nomeMilitar.trim()) {
          busca = buscarCadastroPorNomeOuNip(listaAtual, fb.nomeMilitar);
        }
        if (busca.kind !== 'found') {
          naoEncontrados.push(fb?.tipo === 'ok' ? fb.nomeMilitar : `Participante ${i + 1}`);
          continue;
        }
        const resultado = resultadoPermanenciaLinhas[i]!;
        const tempoMs = tempoMsLinha(i, resultado);
        const tempoStr = formatMsByModality('corrida', tempoMs);
        const atualizado: CadastroItemPersist = {
          ...busca.cadastro,
          resultadoPermanencia: resultado,
          tempoPermanencia: tempoStr,
          dataTafPermanencia: dataHojeBr(),
        };
        bufferCadastros.push(atualizado);
        const idx = listaAtual.findIndex((c) => c.id === busca.cadastro.id);
        if (idx >= 0) listaAtual[idx] = atualizado;
        ok += 1;
      }

      pendingCadastrosRef.current = bufferCadastros;
      pendingCleanupsRef.current = [];
      pendingResultadosNavRef.current = resultadosPerm;

      await persistirLancamentoAplicacao(resultadosPerm);

      if (ok > 0) {
        const aviso =
          naoEncontrados.length > 0
            ? `Registro parcial: não localizado no cadastro: ${naoEncontrados.slice(0, 3).join(', ')}${naoEncontrados.length > 3 ? '…' : ''}.`
            : null;
        abrirFluxoRubricaCandidatos(resultadosPerm, aviso);
      } else {
        Alert.alert(
          'Resultado salvo parcialmente',
          'A sessão foi gravada, mas não foi possível localizar os militares no cadastro.',
          [
            {
              text: 'OK',
              onPress: () => {
                void iniciarFinalizacaoComAssinaturaAplicador(resultadosPerm);
              },
            },
          ],
        );
        setSalvandoResultadosCorrida(false);
        aplicandoResultadoLockRef.current = false;
      }
    } catch {
      limparBufferAplicacao();
      Alert.alert(
        'Erro',
        'Não foi possível gravar os resultados da permanência. Tente novamente.',
      );
      setSalvandoResultadosCorrida(false);
      aplicandoResultadoLockRef.current = false;
    }
  }, [
    resultadoPermanenciaLinhas,
    temposMilitaresMs,
    nParticipantesConfirmado,
    nipsParticipantes,
    nipFeedbackLinhas,
    salvandoResultadosCorrida,
    abrirFluxoRubricaCandidatos,
    persistirLancamentoAplicacao,
    limparBufferAplicacao,
    iniciarFinalizacaoComAssinaturaAplicador,
    getElapsedRaceMs,
  ]);
  const voltarDeTabelaParaNips = useCallback(() => {
    resetCronometroCorrida();
    setRepeticoesParticipantes([]);
    setVoltasConfirmadasProva(false);
    setCorridaEtapa('nips');
    limparSessaoProvaAtiva();
  }, [resetCronometroCorrida, limparSessaoProvaAtiva]);

  const recarregarListaPreCadastros = useCallback(async () => {
    const lista = await getAllPreCadastrosTaf();
    setListaPreCadastros(lista);
  }, []);

  /** Mantém o contador do botão Pré Cadastro atualizado na tela inicial. */
  useEffect(() => {
    if (mostrarProvas || mostrarListaPreCadastro || mostrarFatoresRisco || mostrarRestritos) {
      return;
    }
    void recarregarListaPreCadastros();
  }, [
    mostrarProvas,
    mostrarListaPreCadastro,
    mostrarFatoresRisco,
    mostrarRestritos,
    recarregarListaPreCadastros,
  ]);

  const abrirListaPreCadastro = useCallback(() => {
    void recarregarListaPreCadastros().then(() => {
      setMostrarListaPreCadastro(true);
      setMostrarFatoresRisco(false);
      setMostrarRestritos(false);
      setModoPreCadastro(false);
      setModoTafNaval(false);
      setMostrarProvas(false);
    });
  }, [recarregarListaPreCadastros]);

  const abrirFatoresRisco = useCallback(() => {
    setFatoresRiscoOrigem('home');
    setFatoresRiscoNipInicial(null);
    setFatoresRiscoNomeInicial(null);
    setMostrarFatoresRisco(true);
    setMostrarRestritos(false);
    setMostrarListaPreCadastro(false);
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
  }, []);

  const abrirRestritos = useCallback(() => {
    setMostrarRestritos(true);
    setMostrarFatoresRisco(false);
    setFatoresRiscoOrigem(null);
    setFatoresRiscoNipInicial(null);
    setFatoresRiscoNomeInicial(null);
    setMostrarListaPreCadastro(false);
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
  }, []);

  const recarregarFatoresRisco = useCallback(() => {
    void getAllFatoresRisco()
      .then(setFatoresRiscoPorNip)
      .catch(() => setFatoresRiscoPorNip({}));
  }, []);

  useEffect(() => {
    recarregarFatoresRisco();
  }, [recarregarFatoresRisco, mostrarFatoresRisco, corridaEtapa]);

  const abrirModalFatoresRiscoParticipante = useCallback(
    (index: number) => {
      const nip = nipsParticipantes[index] ?? '';
      const key = nipDigitos(nip);
      const reg = key ? fatoresRiscoPorNip[key] : undefined;
      if (!reg || !temAlertaFatorRisco(reg)) return;
      const fb = nipFeedbackLinhas[index];
      const nome =
        fb?.tipo === 'ok' || fb?.tipo === 'completar_dados'
          ? fb.nomeMilitar
          : reg.nome || `Participante ${index + 1}`;
      setModalFatoresRiscoInfo({
        nome,
        nip: key,
        fatores: listarAlertasFatoresRisco(reg),
      });
    },
    [nipsParticipantes, fatoresRiscoPorNip, nipFeedbackLinhas],
  );

  const participanteTemFatorRisco = useCallback(
    (index: number): boolean => {
      const key = nipDigitos(nipsParticipantes[index] ?? '');
      if (!key) return false;
      return temAlertaFatorRisco(fatoresRiscoPorNip[key]);
    },
    [nipsParticipantes, fatoresRiscoPorNip],
  );

  /** Tem registro salvo em Fatores de Risco (independente de respostas "sim"). */
  const participanteCadastradoFatoresRisco = useCallback(
    (index: number): boolean => {
      const key = nipDigitos(nipsParticipantes[index] ?? '');
      if (!key) return false;
      return Boolean(fatoresRiscoPorNip[key]);
    },
    [nipsParticipantes, fatoresRiscoPorNip],
  );

  const onPressIconeFatoresRiscoParticipante = useCallback(
    (index: number) => {
      const nipLinha = nipsParticipantes[index] ?? '';
      const key = nipDigitos(nipLinha);
      if (key.length !== 8) {
        Alert.alert('Fatores de risco', 'Informe um NIP válido antes de abrir os fatores de risco.');
        return;
      }
      const fb = nipFeedbackLinhas[index];
      const nome =
        fb?.tipo === 'ok' || fb?.tipo === 'completar_dados' ? (fb.nome || '').trim() : '';
      setFatoresRiscoOrigem('nips');
      setFatoresRiscoNipInicial(nipLinha);
      setFatoresRiscoNomeInicial(nome || null);
      setMostrarFatoresRisco(true);
    },
    [nipsParticipantes, nipFeedbackLinhas],
  );

  const voltarInicioAplicarTaf = useCallback(() => {
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setFatoresRiscoOrigem(null);
    setFatoresRiscoNipInicial(null);
    setFatoresRiscoNomeInicial(null);
    setMostrarRestritos(false);
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
    setCorridaEtapa('menu');
  }, []);

  const fecharPainelFatoresRisco = useCallback(() => {
    if (fatoresRiscoOrigem === 'nips') {
      setMostrarFatoresRisco(false);
      setFatoresRiscoOrigem(null);
      setFatoresRiscoNipInicial(null);
      setFatoresRiscoNomeInicial(null);
      recarregarFatoresRisco();
      return;
    }
    voltarInicioAplicarTaf();
  }, [fatoresRiscoOrigem, recarregarFatoresRisco, voltarInicioAplicarTaf]);

  /** Voltar interno da aba Aplicar (nunca troca para a aba Iniciar). */
  const voltarHierarquiaAplicar = useCallback(() => {
    if (mostrarFatoresRisco) {
      fecharPainelFatoresRisco();
      return;
    }
    if (mostrarRestritos || mostrarListaPreCadastro) {
      voltarInicioAplicarTaf();
      return;
    }
    if (mostrarProvas) {
      if (corridaEtapa === 'nips') {
        voltarMenuProvas();
        return;
      }
      if (modoPreCadastro) {
        setModoPreCadastro(false);
        setModoTafNaval(false);
        setMostrarProvas(false);
        void recarregarListaPreCadastros().then(() => setMostrarListaPreCadastro(true));
        return;
      }
      voltarInicioAplicarTaf();
    }
  }, [
    mostrarFatoresRisco,
    mostrarRestritos,
    mostrarListaPreCadastro,
    mostrarProvas,
    corridaEtapa,
    modoPreCadastro,
    fecharPainelFatoresRisco,
    voltarInicioAplicarTaf,
    voltarMenuProvas,
    recarregarListaPreCadastros,
  ]);

  const iniciarNovoPreCadastro = useCallback(() => {
    tipoProvaRef.current = null;
    preCadastroOrigemIdRef.current = null;
    resetCronometroCorrida();
    setPreCadastroEditando(null);
    setModoPreCadastro(true);
    setModoTafNaval(false);
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
    setNomeCodigoPreCadastro(null);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
    setResultadoPermanenciaLinhas([]);
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    dispatchTrial({ type: 'resetAll' });
  }, [resetCronometroCorrida]);

  const iniciarNovoPreCadastroCfn = useCallback(() => {
    tipoProvaRef.current = null;
    preCadastroOrigemIdRef.current = null;
    resetCronometroCorrida();
    setPreCadastroEditando(null);
    setModoPreCadastro(true);
    setModoTafNaval(true);
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
    setNomeCodigoPreCadastro(null);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
    setResultadoPermanenciaLinhas([]);
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    dispatchTrial({ type: 'resetAll' });
  }, [resetCronometroCorrida]);

  const salvarPreCadastro = useCallback(async () => {
    if (!tipoProva) {
      Alert.alert(
        'Atividade não definida',
        modoTafNaval
          ? 'Volte ao menu e escolha a prova CFN desejada.'
          : 'Volte ao menu e escolha Corrida, Natação, Caminhada ou Permanência.',
      );
      return;
    }
    if (nomeCodigoPreCadastro == null) {
      Alert.alert(
        'Nome do pré-cadastro',
        'Selecione um nome (Alfa…Zulu) ou a opção Nenhum.',
      );
      return;
    }
    if (nomeCodigoPreCadastro !== 'Nenhum') {
      if (!isNomeCodigoPreCadastro(nomeCodigoPreCadastro)) {
        Alert.alert(
          'Nome do pré-cadastro',
          'Selecione um nome válido (Alfa…Zulu) ou a opção Nenhum.',
        );
        return;
      }
      const nomeJaUsado = listaPreCadastros.some(
        (p) =>
          p.id !== preCadastroEditando?.id &&
          (p.nomeCodigo || '').trim() === nomeCodigoPreCadastro,
      );
      if (nomeJaUsado) {
        Alert.alert(
          'Nome em uso',
          `O nome ${nomeCodigoPreCadastro} já está em outro pré-cadastro. Escolha outro.`,
        );
        return;
      }
    }
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (OK em cada linha) e preencha data de nascimento e gênero quando solicitado.',
        );
        return;
      }
    }
    const participantes = nipFeedbackLinhas.map((fb, index) => {
      const ok = fb as Extract<NipFeedbackLinha, { tipo: 'ok' }>;
      return {
        nip: nipsParticipantes[index] || '',
        nomeMilitar: ok.nomeMilitar,
        dataNascimento: ok.dataNascimento,
        sexo: ok.sexo,
      };
    });
    const editando = preCadastroEditando;
    const item: PreCadastroTaf = {
      id: editando?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      criadoEm: editando?.criadoEm ?? Date.now(),
      numero: editando?.numero ?? 0, // atribuído em addPreCadastroTaf quando 0
      nomeCodigo:
        nomeCodigoPreCadastro !== 'Nenhum' && isNomeCodigoPreCadastro(nomeCodigoPreCadastro)
          ? nomeCodigoPreCadastro
          : undefined,
      tipoProva,
      normaTaf: modoTafNaval ? 'cfn' : 'armada',
      participantes,
    };
    try {
      await addPreCadastroTaf(item);
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar o pré-cadastro. Tente novamente.');
      return;
    }
    setPreCadastroEditando(null);
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
    setCorridaEtapa('menu');
    setTipoProva(null);
    tipoProvaRef.current = null;
    setNomeCodigoPreCadastro(null);
    await recarregarListaPreCadastros();
    setMostrarListaPreCadastro(true);
    Alert.alert(
      editando ? 'Pré-cadastro atualizado' : 'Pré-cadastro salvo',
      editando
        ? 'As alterações foram salvas com sucesso.'
        : 'Os participantes foram salvos. Use "Iniciar Prova" quando for aplicar o TAF.',
    );
  }, [
    tipoProva,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    recarregarListaPreCadastros,
    modoTafNaval,
    nomeCodigoPreCadastro,
    listaPreCadastros,
    preCadastroEditando,
  ]);

  const iniciarProvaFromPreCadastro = useCallback(
    (pre: PreCadastroTaf) => {
      void (async () => {
        const tipo = pre.tipoProva;
        const n = pre.participantes.length;
        if (n < 1) return;
        const normaCfn = (pre.normaTaf ?? 'armada') === 'cfn';

        let lista: CadastroItemPersist[] = [];
        try {
          lista = await getAllCadastros({ includeDemo: true });
        } catch {
          lista = [];
        }

        tipoProvaRef.current = tipo;
        setTipoProva(tipo);
        setModoTafNaval(normaCfn);
        setModoPreCadastro(false);
        setMostrarListaPreCadastro(false);
        setMostrarFatoresRisco(false);
        setMostrarRestritos(false);
        setMostrarProvas(true);
        preCadastroOrigemIdRef.current = pre.id;
        setNipsParticipantes(pre.participantes.map((p) => p.nip));
        setNipFeedbackLinhas(
          pre.participantes.map((p) => {
            const busca = buscarCadastroPorNomeOuNip(lista, p.nip);
            if (busca.kind === 'found') {
              const campos = camposCadastroParaFeedback(busca.cadastro);
              return {
                tipo: 'ok' as const,
                texto: 'Militar Cadastrado no Sistema.',
                ...campos,
                dataNascimento: p.dataNascimento || campos.dataNascimento,
                sexo: p.sexo ?? campos.sexo,
              };
            }
            return {
              tipo: 'ok' as const,
              texto: 'Militar Cadastrado no Sistema.',
              nomeMilitar: p.nomeMilitar,
              nome: p.nomeMilitar,
              categoria: 'Praças' as const,
              dataNascimento: p.dataNascimento,
              sexo: p.sexo,
            };
          }),
        );
        nipsRepeticaoAutorizadaRef.current = new Set();
        setModalTesteExistente(null);
        setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
        setVoltasConfirmadasProva(false);
        resetCronometroCorrida();

        if (tipo === 'permanencia') {
          setModalPermanenciaFinalizadaVisible(false);
          setErroPermanencia('');
          setResultadoPermanenciaLinhas(Array.from({ length: n }, () => null));
          dispatchTrial({
            type: 'hydrate',
            state: {
              checksVoltas: [],
              chegadaNatacao: [],
              temposMilitaresMs: Array.from({ length: n }, () => null),
              desistenciaParticipantes: [],
              desistenciaVoltasParticipantes: [],
              marcacoesOrdem: [],
            },
          });
          setCorridaEtapa('tabela_permanencia');
        } else if (isProvaComRepeticoes(tipo)) {
          setRepeticoesParticipantes(Array.from({ length: n }, () => ''));
          setCorridaEtapa('tabela_repeticoes');
        } else {
          dispatchTrial({
            type: 'prepararProva',
            nParticipantes: n,
            tipoProva: trialTipoFromProva(tipo),
          });
          setCorridaEtapa('tabela_corrida');
        }
      })();
    },
    [resetCronometroCorrida],
  );

  const excluirPreCadastro = useCallback((pre: PreCadastroTaf) => {
    setPreCadastroParaExcluir(pre);
  }, []);

  const editarPreCadastro = useCallback(
    (pre: PreCadastroTaf) => {
      void (async () => {
        let lista: CadastroItemPersist[] = [];
        try {
          lista = await getAllCadastros({ includeDemo: true });
        } catch { lista = []; }

        setPreCadastroEditando(pre);
        tipoProvaRef.current = pre.tipoProva;
        setTipoProva(pre.tipoProva);
        setModoTafNaval((pre.normaTaf ?? 'armada') === 'cfn');
        setModoPreCadastro(true);
        setMostrarListaPreCadastro(false);
        setMostrarFatoresRisco(false);
        setMostrarRestritos(false);
        setMostrarProvas(true);
        setNomeCodigoPreCadastro(
          pre.nomeCodigo && isNomeCodigoPreCadastro(pre.nomeCodigo)
            ? pre.nomeCodigo
            : 'Nenhum',
        );
        setNipsParticipantes(pre.participantes.map((p) => p.nip));
        setNipFeedbackLinhas(
          pre.participantes.map((p) => {
            const busca = buscarCadastroPorNomeOuNip(lista, p.nip);
            if (busca.kind === 'found') {
              const campos = camposCadastroParaFeedback(busca.cadastro);
              return {
                tipo: 'ok' as const,
                texto: 'Militar Cadastrado no Sistema.',
                ...campos,
                dataNascimento: p.dataNascimento || campos.dataNascimento,
                sexo: p.sexo ?? campos.sexo,
              };
            }
            return {
              tipo: 'ok' as const,
              texto: 'Militar Cadastrado no Sistema.',
              nomeMilitar: p.nomeMilitar,
              nome: p.nomeMilitar,
              categoria: 'Praças' as const,
              dataNascimento: p.dataNascimento,
              sexo: p.sexo,
            };
          }),
        );
        setCorridaEtapa('nips');
        resetCronometroCorrida();
      })();
    },
    [resetCronometroCorrida],
  );

  const executarExclusaoPreCadastro = useCallback(async () => {
    if (!preCadastroParaExcluir || excluindoPreCadastro) return;
    setExcluindoPreCadastro(true);
    try {
      const removido = await removePreCadastroTaf(preCadastroParaExcluir.id);
      if (!removido) {
        Alert.alert('Erro', 'Não foi possível encontrar este pré-cadastro para excluir.');
        return;
      }
      setPreCadastroParaExcluir(null);
      await recarregarListaPreCadastros();
    } catch {
      Alert.alert('Erro', 'Não foi possível excluir o pré-cadastro. Tente novamente.');
    } finally {
      setExcluindoPreCadastro(false);
    }
  }, [preCadastroParaExcluir, excluindoPreCadastro, recarregarListaPreCadastros]);

  const iniciarTaf = useCallback(() => {
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    tipoProvaRef.current = null;
    preCadastroOrigemIdRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
    setResultadoPermanenciaLinhas([]);
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    dispatchTrial({ type: 'resetAll' });
    setRepeticoesParticipantes([]);
  }, [resetCronometroCorrida]);

  const iniciarTafNaval = useCallback(() => {
    setModoPreCadastro(false);
    setModoTafNaval(true);
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    tipoProvaRef.current = null;
    preCadastroOrigemIdRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas(NUMERO_VOLTAS_PADRAO);
    setResultadoPermanenciaLinhas([]);
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    dispatchTrial({ type: 'resetAll' });
    setRepeticoesParticipantes([]);
  }, [resetCronometroCorrida]);

  const tituloProvaCurta = tituloProvaTaf(tipoProva, modoTafNaval);
  const labelAtleta = labelAtletaProva(tipoProva);

  const modalProvaTempoVisible =
    corridaEtapa === 'tabela_corrida' || corridaEtapa === 'tabela_permanencia';

  const modalProvaRepeticoesVisible = corridaEtapa === 'tabela_repeticoes';

  const provaModalTipo: TafProvaTempoModalProva =
    corridaEtapa === 'tabela_permanencia'
      ? 'permanencia'
      : tipoProva === 'natacao'
        ? 'natacao'
        : tipoProva === 'caminhada'
          ? 'caminhada'
          : tipoProva === 'abdominal_prancha'
            ? 'natacao'
            : 'corrida';

  const nomesParticipantesModal = useMemo(
    () =>
      Array.from({ length: nParticipantesConfirmado }, (_, index) => {
        const fb = nipFeedbackLinhas[index];
        return fb?.tipo === 'ok' ? primeiroSegundoNomeComPosto(fb.nomeMilitar) : '—';
      }),
    [nParticipantesConfirmado, nipFeedbackLinhas],
  );

  const participantesComFatorRiscoModal = useMemo(
    () =>
      Array.from({ length: nParticipantesConfirmado }, (_, index) => {
        const key = nipDigitos(nipsParticipantes[index] ?? '');
        return key ? temAlertaFatorRisco(fatoresRiscoPorNip[key]) : false;
      }),
    [nParticipantesConfirmado, nipsParticipantes, fatoresRiscoPorNip],
  );

  const todosMarcadosPermanencia = useMemo(
    () =>
      nParticipantesConfirmado > 0 &&
      Array.from({ length: nParticipantesConfirmado }, (_, i) => i).every(
        (i) =>
          resultadoPermanenciaLinhas[i] === 'aprovado' ||
          resultadoPermanenciaLinhas[i] === 'reprovado',
      ),
    [nParticipantesConfirmado, resultadoPermanenciaLinhas],
  );

  const podeAplicarModal =
    corridaEtapa === 'tabela_permanencia'
      ? todosMarcadosPermanencia
      : todosIntegrantesComTempoRegistrado;

  const mostrarNotaModal =
    mostrarColunaNotaCorrida ||
    mostrarColunaNotaCaminhada ||
    mostrarColunaNotaNatacao ||
    mostrarColunaNotaPrancha;

  const getNotaModal = useCallback(
    (index: number) => {
      if (tipoProva === 'corrida') return notaCorridaPorLinha[index] ?? '—';
      if (tipoProva === 'caminhada') return notaCaminhadaPorLinha[index] ?? '—';
      if (tipoProva === 'natacao') return notaNatacaoPorLinha[index] ?? '—';
      if (tipoProva === 'abdominal_prancha') return notaPranchaPorLinha[index] ?? '—';
      return '—';
    },
    [
      tipoProva,
      notaCorridaPorLinha,
      notaCaminhadaPorLinha,
      notaNatacaoPorLinha,
      notaPranchaPorLinha,
    ],
  );

  const isNotaReprovadoModal = useCallback(
    (index: number) => isNotaReprovacaoTexto(getNotaModal(index)),
    [getNotaModal],
  );

  const flowHeader = useMemo(() => {
    if (mostrarListaPreCadastro) {
      return {
        title: 'Pré-cadastros',
        subtitle: 'Gerencie provas preparadas para iniciar com um toque',
      };
    }
    if (mostrarFatoresRisco) {
      return {
        title: 'Fatores de Risco',
        subtitle: 'Identifique o militar pelo NIP ou pelo nome',
      };
    }
    if (mostrarRestritos) {
      return {
        title: 'Restritos',
        subtitle: 'Registre a dispensa pelo NIP ou nome e o período',
      };
    }
    if (mostrarProvas) {
      if (corridaEtapa === 'menu') {
        return {
          title: modoPreCadastro
            ? modoTafNaval
              ? 'Nova prova CFN'
              : 'Nova prova Armada'
            : modoTafNaval
              ? 'TAF Naval'
              : 'Modalidades',
          subtitle: modoPreCadastro
            ? modoTafNaval
              ? 'Selecione a atividade do pré-cadastro CFN'
              : 'Selecione a atividade do pré-cadastro Armada'
            : modoTafNaval
              ? 'Provas dos Fuzileiros Navais — CGCFN-108'
              : 'Escolha a prova que será aplicada agora',
        };
      }
      if (corridaEtapa === 'nips') {
        return {
          title: tituloProvaCurta,
          subtitle:
            nParticipantesConfirmado === 1
              ? 'Informe o NIP do participante'
              : `Confirme os NIPs de ${nParticipantesConfirmado} participantes`,
        };
      }
    }
    return {
      title: 'Aplicar TAF',
      subtitle: 'Provas com cronômetro integrado',
    };
  }, [
    mostrarListaPreCadastro,
    mostrarFatoresRisco,
    mostrarRestritos,
    mostrarProvas,
    corridaEtapa,
    modoPreCadastro,
    modoTafNaval,
    tituloProvaCurta,
    nParticipantesConfirmado,
  ]);

  const handleProvaSelect = useCallback(
    (id: TipoProvaTAF) => {
      if (id === 'corrida') abrirCorrida();
      else if (id === 'natacao') abrirNatacao();
      else if (id === 'permanencia') abrirPermanencia();
      else if (id === 'caminhada') abrirCaminhada();
      else if (id === 'flexao_barra') abrirFlexaoBarra();
      else if (id === 'flexao_solo') abrirFlexaoSolo();
      else if (id === 'abdominal_remador') abrirAbdominalRemador();
      else abrirAbdominalPrancha();
    },
    [
      abrirCorrida,
      abrirNatacao,
      abrirPermanencia,
      abrirCaminhada,
      abrirFlexaoBarra,
      abrirFlexaoSolo,
      abrirAbdominalRemador,
      abrirAbdominalPrancha,
    ],
  );

  const todosRepeticoesPreenchidas = useMemo(() => {
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return false;
    if (nParticipantesConfirmado < 1) return false;
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      const raw = (repeticoesParticipantes[i] ?? '').trim();
      const reps = parseInt(raw, 10);
      if (!Number.isFinite(reps) || reps < 0) return false;
    }
    return true;
  }, [tipoProva, nParticipantesConfirmado, repeticoesParticipantes]);

  const atualizarRepeticaoParticipante = useCallback((index: number, text: string) => {
    setRepeticoesParticipantes((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }, []);

  const opcoesNomeCodigoPreCadastro = useMemo(() => {
    const listaParaDisponiveis = preCadastroEditando
      ? listaPreCadastros.filter((p) => p.id !== preCadastroEditando.id)
      : listaPreCadastros;
    return ['Nenhum', ...nomesCodigoDisponiveis(listaParaDisponiveis)] as const;
  }, [listaPreCadastros, preCadastroEditando]);

  const nomeCodigoSelectWebStyle = useMemo(
    () =>
      ({
        width: '100%',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: inputBorder,
        borderRadius: 12,
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 16,
        backgroundColor: inputBg,
        color: theme.text,
      }) as object,
    [inputBg, inputBorder, theme.text],
  );

  return (
    <AplicarTafShell>
    <SafeAreaViewInsets
      style={[styles.safe, { backgroundColor: 'transparent' }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 4 : 0}
      >
      <ModalTesteJaAplicado
        info={modalTesteExistente}
        onClose={fecharModalTesteExistente}
        onConfirmarRepeticao={confirmarRepeticaoTeste}
      />

      <ModalModalidadeExcludente
        info={modalModalidadeExcludente}
        onProsseguir={prosseguirModalidadeExcludente}
        onDesistir={desistirModalidadeExcludente}
      />

      <ConfirmacaoExcluirPreCadastroModal
        preCadastro={preCadastroParaExcluir}
        loading={excluindoPreCadastro}
        onClose={() => {
          if (!excluindoPreCadastro) setPreCadastroParaExcluir(null);
        }}
        onConfirm={() => void executarExclusaoPreCadastro()}
      />

      <AppModal
        visible={modalPermanenciaFinalizadaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPermanenciaFinalizadaVisible(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.modalTempoOverlay, { paddingHorizontal: horizontalPad }]}>
          <View style={styles.modalFuturisticCard}>
            <LinearGradient
              colors={[theme.primary, '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalFuturisticStripe}
            />
            <Text style={styles.modalPermanenciaFinalTitulo}>PERMANÊNCIA FINALIZADA</Text>
            <Text style={styles.modalPermanenciaFinalSub}>
              O tempo de 10 minutos foi atingido. Continue marcando Aprovado ou Reprovado e
              aplique o resultado quando terminar.
            </Text>
            <AplicarTafPrimaryButton
              label="OK"
              onPress={() => setModalPermanenciaFinalizadaVisible(false)}
            />
          </View>
        </View>
      </AppModal>

      <AppModal
        visible={modalTempoRegistradoVisible && !continuidadeProvaVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalTempoRegistrado}
        accessibilityViewIsModal
      >
        <View style={[styles.modalTempoOverlay, { paddingHorizontal: horizontalPad }]}>
          <View style={styles.modalFuturisticCard}>
            <LinearGradient
              colors={['#059669', '#14b8a6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalFuturisticStripe}
            />
            <Text style={styles.modalTempoMensagemCadastro}>
              Resultado já salvo. Você pode confirmar a assinatura do aplicador (opcional).
            </Text>
            {modalParcialAviso ? (
              <Text style={styles.modalTempoParcialCadastro}>{modalParcialAviso}</Text>
            ) : null}
            <AplicarTafPrimaryButton label="OK" onPress={fecharModalTempoRegistrado} />
          </View>
        </View>
      </AppModal>
      <AplicarTafRubricaCandidatoModal
        visible={modalRubricaNatacaoVisible && !continuidadeProvaVisible}
        horizontalPad={horizontalPad}
        paddingBottom={Math.max(insets.bottom, 16)}
        lista={listaResultadosRubricaNatacao}
        indice={indiceRubricaNatacao}
        rubricaStrokes={rubricaStrokes}
        rubricaStrokeAtual={rubricaStrokeAtual}
        svgSalvoAtual={
          (
            pendingResultadosNavRef.current?.[indiceRubricaNatacao]?.rubricaCandidatoSvg ||
            rubricasSvgRef.current[indiceRubricaNatacao] ||
            ''
          ).trim() || null
        }
        rubricaCanvasWidth={rubricaCanvasWidth}
        erro={erroRubricaNatacao}
        onRequestClose={onVoltarRubricaCandidato}
        onVoltar={onVoltarRubricaCandidato}
        onCancelarFluxo={cancelarFluxoRubricaCandidatos}
        onIrParaIndex={irParaRubricaIndex}
        onCanvasWidth={setRubricaCanvasWidth}
        onStartStroke={iniciarRubricaStroke}
        onMoveStroke={moverRubricaStroke}
        onEndStroke={finalizarRubricaStroke}
        onLimpar={limparRubricaNatacaoAtual}
        onConfirmar={confirmarRubricaNatacao}
      />
      <FluxoAssinaturaAplicadorModal
        visible={fluxoAplicadorVisible && !continuidadeProvaVisible}
        onConcluir={(assinatura) => void onConcluirAssinaturaAplicador(assinatura)}
        onCancelar={onCancelarAssinaturaAplicador}
      />

      <ScrollView
        ref={nipsScrollRef}
        contentContainerStyle={[
          styles.scrollContentCadastro,
          { paddingHorizontal: horizontalPad, paddingBottom: scrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!modalRubricaNatacaoVisible && !fluxoAplicadorVisible}
        onContentSizeChange={() => {
          if (scrollNipsAposAddRef.current && corridaEtapa === 'nips') {
            rolarParaNovoNip();
          }
        }}
      >
        <View style={styles.centerWrap}>
          {!mostrarProvas && !mostrarListaPreCadastro && !mostrarFatoresRisco && !mostrarRestritos ? (
            <AplicarTafCenteredTabHeader
              title={flowHeader.title}
              subtitle={flowHeader.subtitle}
              footer={<TopActionIcons activeRoute="AplicarTAF" inline centered />}
            />
          ) : (
            <AplicarTafFlowHeader
              title={flowHeader.title}
              subtitle={flowHeader.subtitle}
              onBack={voltarHierarquiaAplicar}
            />
          )}

          {!mostrarProvas && !mostrarListaPreCadastro && !mostrarFatoresRisco && !mostrarRestritos ? (
            <AplicarTafHomeLauncher
              onIniciarTaf={iniciarTaf}
              onIniciarTafNaval={iniciarTafNaval}
              onPreCadastro={abrirListaPreCadastro}
              onFatoresRisco={abrirFatoresRisco}
              onRestritos={abrirRestritos}
              preCadastrosCount={listaPreCadastros.length}
            />
          ) : null}

          {mostrarFatoresRisco ? (
            <AplicarTafFatoresRiscoPanel
              key={fatoresRiscoNipInicial ? `fr-${nipDigitos(fatoresRiscoNipInicial)}` : 'fr-home'}
              nipInicial={fatoresRiscoNipInicial ?? undefined}
              nomeInicial={fatoresRiscoNomeInicial ?? undefined}
              onVoltar={fecharPainelFatoresRisco}
              onSalvo={recarregarFatoresRisco}
            />
          ) : null}

          {mostrarRestritos ? (
            <AplicarTafRestritosPanel onVoltar={voltarInicioAplicarTaf} />
          ) : null}

          {mostrarListaPreCadastro ? (
            <AplicarTafGlassPanel accent="cyan">
              <AplicarTafBackLink label="Voltar ao início" onPress={voltarInicioAplicarTaf} />
              <AplicarTafSectionHeader
                kicker="BIBLIOTECA"
                title="Pré-cadastros salvos"
                subtitle={`Armada: corrida, natação e permanência (até ${MAX_PRE_CADASTRO_PARTICIPANTES}). Caminhada: até ${MAX_PARTICIPANTES}. CFN: provas dos Fuzileiros Navais (até ${MAX_PRE_CADASTRO_PARTICIPANTES}).`}
              />

              {listaPreCadastros.length === 0 ? (
                <Text style={[ts.bodySecondary, styles.preCadastroVazio]}>
                  Nenhum pré-cadastro salvo ainda.
                </Text>
              ) : (
                listaPreCadastros.map((pre) => (
                  <AplicarTafPreCadastroCard
                    key={pre.id}
                    numero={pre.numero > 0 ? pre.numero : 1}
                    titulo={
                      (pre.nomeCodigo || '').trim() ||
                      labelTipoProvaPreCadastro(pre)
                    }
                    meta={
                      (pre.nomeCodigo || '').trim()
                        ? `${labelTipoProvaPreCadastro(pre)} · ${metaPreCadastro(pre)}`
                        : metaPreCadastro(pre)
                    }
                    nomesPreview={pre.participantes.map((p) => p.nomeMilitar).join(', ')}
                    accentColors={PRE_CADASTRO_ACCENTS[pre.tipoProva] ?? PRE_CADASTRO_ACCENTS.corrida}
                    onIniciar={() => iniciarProvaFromPreCadastro(pre)}
                    onExcluir={() => excluirPreCadastro(pre)}
                    onEditar={() => editarPreCadastro(pre)}
                  />
                ))
              )}

              <View style={styles.preCadastroActions}>
                <AplicarTafPrimaryButton
                  label="+ Novo Pré Cadastro Armada"
                  onPress={iniciarNovoPreCadastro}
                />
                <AplicarTafPrimaryButton
                  label="+ Novo Pré Cadastro CFN"
                  onPress={iniciarNovoPreCadastroCfn}
                  variant="outline"
                />
              </View>
            </AplicarTafGlassPanel>
          ) : null}

        {mostrarProvas && corridaEtapa === 'menu' ? (
          <AplicarTafGlassPanel accent="violet">
            <View style={styles.section}>
              {modoPreCadastro ? (
                <AplicarTafBackLink
                  label="Voltar para lista de pré-cadastros"
                  onPress={() => {
                    setModoPreCadastro(false);
                    setModoTafNaval(false);
                    setMostrarProvas(false);
                    void recarregarListaPreCadastros().then(() => setMostrarListaPreCadastro(true));
                  }}
                />
              ) : (
                <AplicarTafBackLink label="Voltar ao início" onPress={voltarInicioAplicarTaf} />
              )}
              <AplicarTafSectionHeader
                kicker={
                  modoPreCadastro
                    ? preCadastroEditando
                      ? modoTafNaval ? 'EDITAR PRÉ-CADASTRO CFN' : 'EDITAR PRÉ-CADASTRO'
                      : modoTafNaval ? 'PRÉ-CADASTRO CFN' : 'PRÉ-CADASTRO ARMADA'
                    : modoTafNaval
                      ? 'TAF NAVAL'
                      : 'PROVA AO VIVO'
                }
                title={modoPreCadastro ? (preCadastroEditando ? 'Selecione a atividade' : 'Selecione a atividade') : modoTafNaval ? 'Provas dos Fuzileiros Navais' : 'Selecione a prova'}
                subtitle={
                  modoPreCadastro
                    ? modoTafNaval
                      ? `Provas CFN — até ${MAX_PRE_CADASTRO_PARTICIPANTES} participantes por atividade.`
                      : `Armada: corrida, natação e permanência (até ${MAX_PRE_CADASTRO_PARTICIPANTES}). Caminhada: até ${MAX_PARTICIPANTES}.`
                    : modoTafNaval
                      ? 'Corrida 3200 m, natação 100 m, flexões, abdominais e permanência — CGCFN-108 § 5.5.2'
                      : 'Toque na modalidade para identificar os participantes e iniciar'
                }
              />
              <AplicarTafProvaSelector
                variant={modoTafNaval ? 'naval' : 'padrao'}
                onSelect={handleProvaSelect}
              />
            </View>
          </AplicarTafGlassPanel>
        ) : null}

        {mostrarProvas && corridaEtapa === 'nips' && !mostrarFatoresRisco ? (
          <AplicarTafGlassPanel accent="violet">
            <View style={styles.section}>
              <View style={styles.identTopRow}>
                <View style={styles.identTopBack}>
                  <AplicarTafBackLink
                    label="Voltar para seleção de provas"
                    onPress={voltarMenuProvas}
                  />
                </View>
                <AplicarTafModoTesteBar
                  onPreencherNips={preencherNipsDemonstracao}
                  onLimparNips={limparNipsDemonstracao}
                  quantidadeInicial={Math.max(1, nParticipantesConfirmado)}
                  quantidadeMaxima={
                    modoTafNaval ? DEMO_TOTAL_CFN : DEMO_TOTAL_MILITARES - DEMO_TOTAL_CFN
                  }
                />
              </View>
              <AplicarTafSectionHeader
                kicker="IDENTIFICAÇÃO"
                title={`${tituloProvaCurta} — NIPs`}
                subtitle={
                  demoAtivo
                    ? `NIPs, idade e gênero dos ${nParticipantesConfirmado} participantes ficam bloqueados no Modo Teste. Use o botão acima para preencher.`
                    : modoPreCadastro
                      ? 'Opcional: escolha Alfa…Zulu ou Nenhum. Depois informe o NIP de cada participante.'
                      : 'Informe o NIP de cada participante. Use Adicionar Participante para incluir mais.'
                }
              />

            {modoPreCadastro ? (
              <View
                style={[
                  styles.nomeCodigoBox,
                  { backgroundColor: inputBg, borderColor: inputBorder },
                ]}
              >
                <Text style={[ts.label, styles.nomeCodigoLabel, { color: theme.textMuted }]}>
                  Nome do pré-cadastro
                </Text>
                <Text style={[ts.caption, { color: theme.textSecondary, marginBottom: 8 }]}>
                  Escolha um nome (único) ou Nenhum para usar só a numeração. Nomes já em uso não
                  aparecem.
                </Text>
                {Platform.OS === 'web' ? (
                  <select
                    value={nomeCodigoPreCadastro ?? ''}
                    aria-label="Nome do pré-cadastro"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '') {
                        setNomeCodigoPreCadastro(null);
                        return;
                      }
                      if (v === 'Nenhum' || isNomeCodigoPreCadastro(v)) {
                        setNomeCodigoPreCadastro(v);
                      }
                    }}
                    style={nomeCodigoSelectWebStyle}
                  >
                    <option value="">Selecione…</option>
                    {opcoesNomeCodigoPreCadastro.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome === 'Nenhum' ? 'Nenhum (apenas numeração)' : nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <View style={[styles.nomeCodigoSelectList, { borderColor: theme.border }]}>
                    <ScrollView
                      nestedScrollEnabled
                      showsVerticalScrollIndicator
                      style={{ maxHeight: 200 }}
                    >
                      {opcoesNomeCodigoPreCadastro.map((nome) => {
                        const active = nomeCodigoPreCadastro === nome;
                        return (
                          <TouchableOpacity
                            key={nome}
                            accessibilityRole="button"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={
                              nome === 'Nenhum' ? 'Sem nome de código' : `Nome ${nome}`
                            }
                            onPress={() => setNomeCodigoPreCadastro(nome)}
                            style={[
                              styles.nomeCodigoSelectRow,
                              {
                                backgroundColor: active ? theme.primary : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: '600',
                                color: active
                                  ? theme.tokens.textOnPrimary
                                  : theme.textSecondary,
                              }}
                            >
                              {nome === 'Nenhum' ? 'Nenhum (apenas numeração)' : nome}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
                {nomesCodigoDisponiveis(listaPreCadastros).length === 0 ? (
                  <Text style={[ts.caption, { color: theme.textSecondary, marginTop: 8 }]}>
                    Todos os nomes Alfa–Zulu estão em uso. Você ainda pode escolher Nenhum.
                  </Text>
                ) : null}
              </View>
            ) : null}

            <AplicarTafNipsList
              nips={nipsParticipantes}
              feedbackLinhas={nipFeedbackLinhas}
              demoAtivo={demoAtivo}
              labelAtleta={labelAtleta}
              onAtualizarNip={atualizarNip}
              onVerificarNip={(index) => void verificarNipNoCadastro(index)}
              onRemoverPress={solicitarExclusaoParticipanteNip}
              onEditarMilitar={setModalEditarIdadeGeneroIndex}
              onAtualizarDados={atualizarDadosNipLinha}
              onConfirmarDados={(index) => void confirmarDadosNipLinha(index)}
              participanteTemFatorRisco={participanteTemFatorRisco}
              participanteCadastradoFatoresRisco={participanteCadastradoFatoresRisco}
              onPressFatoresRisco={onPressIconeFatoresRiscoParticipante}
              onAbrirInfoFatoresRisco={abrirModalFatoresRiscoParticipante}
            />

            {erroParticipantes ? <Text style={styles.erroText}>{erroParticipantes}</Text> : null}
            <View ref={nipsFimAnchorRef} collapsable={false} style={styles.nipsFimAnchor} />
            <AplicarTafPrimaryButton
              label="Adicionar Participante"
              variant="outline"
              onPress={adicionarParticipanteNip}
            />
            <AplicarTafPrimaryButton
              label={modoPreCadastro ? 'Salvar Pré Cadastro' : `Preparar ${tituloProvaCurta}`}
              onPress={
                modoPreCadastro
                  ? () => void salvarPreCadastro()
                  : tipoProva === 'permanencia'
                    ? prepararPermanencia
                    : tipoProva && isProvaComRepeticoes(tipoProva)
                      ? prepararProvaRepeticoes
                      : prepararProva
              }
            />
            </View>
          </AplicarTafGlassPanel>
        ) : null}
        </View>
      </ScrollView>

      <FatoresRiscoInfoModal
        visible={modalFatoresRiscoInfo != null}
        nome={modalFatoresRiscoInfo?.nome ?? ''}
        nip={modalFatoresRiscoInfo?.nip ?? ''}
        fatores={modalFatoresRiscoInfo?.fatores ?? []}
        onClose={() => setModalFatoresRiscoInfo(null)}
      />

      <EditarIdadeGeneroMilitarModal
        visible={!demoAtivo && modalEditarOk != null}
        nome={modalEditarOk?.nome ?? ''}
        categoria={modalEditarOk?.categoria}
        postoGrad={
          modalEditarOk?.categoria === 'Oficiais'
            ? modalEditarOk?.oficial
            : modalEditarOk?.praca
        }
        nip={
          modalEditarIdadeGeneroIndex != null
            ? (nipsParticipantes[modalEditarIdadeGeneroIndex] ?? '')
            : ''
        }
        dataNascimento={modalEditarOk?.dataNascimento ?? ''}
        sexo={modalEditarOk?.sexo}
        vinculo={modalEditarOk?.vinculo ?? null}
        onClose={() => setModalEditarIdadeGeneroIndex(null)}
        onSalvar={salvarEdicaoIdadeGenero}
      />

      <ConfirmacaoExcluirParticipanteNipModal
        visible={participanteNipParaExcluir != null}
        index={participanteNipParaExcluir ?? 0}
        nip={nipExclusaoParticipante}
        nome={nomeExclusaoParticipante}
        hint={
          exclusaoParticipanteOrigem === 'prova'
            ? 'O militar será removido desta prova ativa. Tempos e marcações dele serão descartados.'
            : undefined
        }
        onClose={() => {
          setParticipanteNipParaExcluir(null);
          setExclusaoParticipanteOrigem('nips');
        }}
        onConfirm={confirmarExclusaoParticipanteNip}
      />

      <CadastroRapidoMilitarModal
        visible={modalCadastroRapido != null}
        nip={modalCadastroRapido?.nip ?? ''}
        onClose={() => setModalCadastroRapido(null)}
        onCadastrado={onMilitarCadastradoRapido}
      />

      <ContinuidadeProvaAtivaModal
        visible={continuidadeProvaVisible}
        provaLabel={continuidadeProvaMeta?.provaLabel ?? tituloProvaCurta}
        participantesCount={
          continuidadeProvaMeta?.participantesCount ?? nParticipantesConfirmado
        }
        onContinuar={() => {
          setContinuidadeProvaVisible(false);
          persistirProvaAtivaAgora();
        }}
        onDescartar={descartarSessaoProvaAtivaRestaurada}
      />

      <TafProvaTempoModal
        visible={
          mostrarProvas &&
          modalProvaTempoVisible &&
          !modalRubricaNatacaoVisible &&
          !modalTempoRegistradoVisible &&
          !fluxoAplicadorVisible &&
          !continuidadeProvaVisible
        }
        onClose={voltarDeTabelaParaNips}
        prova={provaModalTipo}
        tituloProva={tituloProvaCurta}
        labelAtleta={labelAtleta}
        tempoExibido={tempoExibido}
        subscribeTempoExibido={stopwatch.subscribeTempoExibido}
        cronometroEstado={cronometroEstado}
        cronometroPausadoTexto={cronometroPausadoTexto}
        onCronometroPausadoTextoChange={onCronometroPausadoTextoChange}
        onBlurCronometroPausado={onBlurCronometroPausado}
        onIniciarCronometro={iniciarCronometroCorrida}
        onPararCronometro={pararCronometroCorrida}
        onPausarCronometro={pausarCronometroCorrida}
        onContinuarCronometro={continuarCronometroCorrida}
        cronometroHint={
          corridaEtapa === 'tabela_permanencia' ? 'Limite da prova: 10:00:00' : undefined
        }
        numeroVoltas={numeroVoltas}
        onChangeNumeroVoltas={onChangeNumeroVoltas}
        onVoltasConfirmadas={() => setVoltasConfirmadasProva(true)}
        voltasJaConfirmadas={voltasConfirmadasProva}
        nColunasVoltas={nColunasVoltas}
        nParticipantes={nParticipantesConfirmado}
        nomesParticipantes={nomesParticipantesModal}
        participantesComFatorRisco={participantesComFatorRiscoModal}
        onPressNomeParticipante={abrirModalFatoresRiscoParticipante}
        onDoublePressNomeParticipante={solicitarExclusaoParticipanteProva}
        checksVoltas={checksVoltas}
        chegadaNatacao={chegadaNatacao}
        ultimaMarcacaoKey={ultimaMarcacaoChecklistKey}
        onToggleVolta={toggleCheckVolta}
        onToggleChegada={toggleMarcarChegadaNatacao}
        desistenciaParticipantes={desistenciaParticipantes}
        onConfirmDesistencia={confirmarDesistenciaParticipante}
        onClearDesistencia={limparDesistenciaParticipante}
        nipsParticipantes={nipsParticipantes}
        temposMilitaresMs={temposMilitaresMs}
        formatMs={formatMs}
        mostrarTempo={mostrarColunaTempo}
        mostrarNota={mostrarNotaModal}
        getNota={getNotaModal}
        isNotaReprovado={isNotaReprovadoModal}
        resultadosPermanencia={resultadoPermanenciaLinhas}
        onTogglePermanencia={togglePermanenciaResultado}
        podeAplicar={podeAplicarModal}
        onAplicar={() => {
          if (corridaEtapa === 'tabela_permanencia') {
            void onCadastrarPermanencia();
          } else {
            void onCadastrarResultados();
          }
        }}
        salvando={salvandoResultadosCorrida}
        erroAplicar={corridaEtapa === 'tabela_permanencia' ? erroPermanencia : undefined}
      />

      <TafProvaRepeticoesModal
        visible={
          mostrarProvas && modalProvaRepeticoesVisible && !continuidadeProvaVisible
        }
        onClose={voltarDeTabelaParaNips}
        tituloProva={tituloProvaCurta}
        nParticipantes={nParticipantesConfirmado}
        nomesParticipantes={nomesParticipantesModal}
        nipsParticipantes={nipsParticipantes}
        participantesComFatorRisco={participantesComFatorRiscoModal}
        onPressNomeParticipante={abrirModalFatoresRiscoParticipante}
        onDoublePressNomeParticipante={solicitarExclusaoParticipanteProva}
        valores={repeticoesParticipantes}
        onChangeValor={atualizarRepeticaoParticipante}
        getNota={(index) => notaRepeticoesPorLinha[index] ?? '—'}
        isNotaReprovado={(index) => (notaRepeticoesPorLinha[index] ?? '') === 'REPROVADO'}
        podeAplicar={todosRepeticoesPreenchidas}
        onAplicar={() => void onCadastrarRepeticoes()}
        salvando={salvandoResultadosCorrida}
        hint={
          tipoProva === 'flexao_barra'
            ? 'Prova masculina. Informe o total de repetições válidas na barra.'
            : 'Informe o total de repetições válidas de cada participante.'
        }
      />
      </KeyboardAvoidingView>
    </SafeAreaViewInsets>
    </AplicarTafShell>
  );
}

