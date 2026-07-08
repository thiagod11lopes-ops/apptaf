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
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
  GestureResponderEvent,
  KeyboardAvoidingView,
} from 'react-native';
import { AppModal } from '../components/premium/AppModal';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { SafeAreaView as SafeAreaViewInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import type { AppTheme } from '../theme/premium';
import { PREMIUM } from '../theme/premium';
import { AplicarTafShell } from '../components/taf/aplicar/AplicarTafShell';
import {
  AplicarTafFlowHeader,
  AplicarTafCenteredTabHeader,
  AplicarTafGlassPanel,
  AplicarTafSectionHeader,
  AplicarTafBackLink,
  AplicarTafPrimaryButton,
  AplicarTafInput,
} from '../components/taf/aplicar/AplicarTafUi';
import { AplicarTafHomeLauncher } from '../components/taf/aplicar/AplicarTafHomeLauncher';
import { AplicarTafProvaSelector } from '../components/taf/aplicar/AplicarTafProvaSelector';
import {
  AplicarTafPreCadastroCard,
  PRE_CADASTRO_ACCENTS,
} from '../components/taf/aplicar/AplicarTafPreCadastroCard';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { AplicarTafDemoNipsIconButton } from '../components/taf/aplicar/AplicarTafDemoNipsIconButton';
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
} from '../components/assinatura/AssinaturaFuturistaUi';
import {
  type ResultadoPermanenciaOpcao,
} from '../components/PermanenciaTafPanel';
import {
  TafProvaTempoModal,
  type TafProvaTempoModalProva,
} from '../components/taf/TafProvaTempoModal';
import { LabelNip } from '../components/LabelNip';
import { getAllCadastros, addCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addSessaoAplicacao, getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { aplicarRubricasEmCadastros } from '../utils/persistirRubricaCadastro';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
import {
  buscarRegistroModalidadeExistente,
  removerParticipanteModalidadeDoHistorico,
} from '../utils/registroModalidadeHistorico';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import {
  filtrarCadastrosDemonstracao,
  nipFeedbackOkFromCadastro,
} from '../utils/aplicarTafDemonstracao';
import {
  isModoDemonstracaoAtivo,
  subscribeModoDemonstracao,
} from '../services/modoDemonstracao';
import { cadastroPrecisaCompletarDadosTaf, dataNascimentoCadastroValida } from '../utils/cadastroDadosTaf';
import { dataHojeBr } from '../utils/tafRegistro';
import { detectarConflitoCorridaCaminhada, removerModalidadeOpostaDistanciaDoHistorico } from '../utils/corridaCaminhadaExcludente';
import { formatMsByModality, parseTafPerformanceInput, type TafModality } from '../taf/tafTimeFormat';
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
} from './aplicarTafNotaHelpers';
import { useTafTimeFormat } from '../hooks/useTafTimeFormat';
import type { RootStackParamList, ResultadoCorridaItem } from '../navigation/AppNavigator';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';
import {
  aplicarTafTrialReducer,
  initialTrialTableState,
} from './aplicarTafTrialReducer';
import {
  addPreCadastroTaf,
  getAllPreCadastrosTaf,
  MAX_PRE_CADASTRO_PARTICIPANTES,
  removePreCadastroTaf,
  type PreCadastroTaf,
} from '../services/preCadastroTafStorage';

/** Máscara NIP: 00.0000.00 (igual ao cadastro) */
function formatNipInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 6);
  const c = digits.slice(6, 8);
  if (digits.length <= 2) return a;
  if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
  return `${a}.${b}.${c}`;
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}/${mm}`;
  return `${dd}/${mm}/${yyyy}`;
}

const MAX_PARTICIPANTES = 200;

/** Duração da prova de permanência — ao atingir, exibe modal de finalização. */
const PERMANENCIA_DURACAO_MS = 10 * 60 * 1000;

type CorridaEtapa =
  | 'menu'
  | 'participantes'
  | 'nips'
  | 'tabela_corrida'
  | 'tabela_permanencia'
  | 'tabela_repeticoes';

function trialTipoFromProva(tipo: TipoProvaTAF): 'corrida' | 'natacao' | 'caminhada' {
  if (tipo === 'natacao' || tipo === 'abdominal_prancha') return 'natacao';
  if (tipo === 'caminhada') return 'caminhada';
  return 'corrida';
}

/** Pré-cadastro: caminhada usa o limite da prova ao vivo; demais atividades ficam em 15. */
function limiteParticipantesPreCadastro(tipo: TipoProvaTAF | null): number {
  if (tipo === 'caminhada') return MAX_PARTICIPANTES;
  return MAX_PRE_CADASTRO_PARTICIPANTES;
}

/** Cronômetro da corrida: pode pausar e retomar antes de parar de vez. */
type CronometroCorridaEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

type NipFeedbackLinha =
  | { tipo: 'ok'; texto: string; nomeMilitar: string; dataNascimento: string; sexo?: 'M' | 'F' }
  | {
      tipo: 'completar_dados';
      nomeMilitar: string;
      cadastro: CadastroItemPersist;
      dataNascimento: string;
      sexo: 'M' | 'F';
      erro?: string;
    }
  | { tipo: 'erro'; texto: string }
  | null;

const MAX_VOLTAS_COLUNAS = 99;

function labelTipoProvaPreCadastro(pre: PreCadastroTaf): string {
  const norma = pre.normaTaf ?? 'armada';
  const titulo = tituloProvaTaf(pre.tipoProva, norma === 'cfn');
  return norma === 'cfn' ? `CFN · ${titulo}` : titulo;
}

function metaPreCadastro(pre: PreCadastroTaf): string {
  const norma = pre.normaTaf === 'cfn' ? 'CFN' : 'Armada';
  const qtd = pre.participantes.length;
  return `${norma} · ${qtd} participante${qtd !== 1 ? 's' : ''} · ${formatarDataPreCadastro(pre.criadoEm)}`;
}

function formatarDataPreCadastro(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

type RubricaPoint = { x: number; y: number };
type RubricaStroke = RubricaPoint[];

function buildStrokePath(points: RubricaPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

function buildRubricaSvgDataUrl(
  strokes: RubricaStroke[],
  width: number,
  height: number,
  strokeColor: string,
  bgColor: string,
): string {
  const paths = strokes
    .filter((s) => s.length > 0)
    .map(
      (s) =>
        `<path d="${buildStrokePath(s)}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><rect width="100%" height="100%" fill="${bgColor}"/>${paths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Situação no modal de rúbrica — corrida e natação (alinhada ao PDF). */
function textoSituacaoRubricaModal(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto) return r.reprovacaoTexto;
  if (r.notaTexto === 'REPROVADO') return 'Reprovado';
  if (r.notaTexto != null && r.notaTexto !== '') return 'Aprovado';
  return '—';
}

function textoNotaRubricaModal(r: ResultadoCorridaItem): string {
  const t = r.notaTexto ?? r.noraTexto;
  if (t == null || t === '') return '—';
  return t;
}

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
  const [modoPreCadastro, setModoPreCadastro] = useState(false);
  const [modoTafNaval, setModoTafNaval] = useState(false);
  const [repeticoesParticipantes, setRepeticoesParticipantes] = useState<string[]>([]);
  const [listaPreCadastros, setListaPreCadastros] = useState<PreCadastroTaf[]>([]);
  const [preCadastroParaExcluir, setPreCadastroParaExcluir] = useState<PreCadastroTaf | null>(null);
  const [excluindoPreCadastro, setExcluindoPreCadastro] = useState(false);
  const [mostrarProvas, setMostrarProvas] = useState(false);
  const [tipoProva, setTipoProva] = useState<TipoProvaTAF | null>(null);
  const tipoProvaRef = useRef<TipoProvaTAF | null>(null);
  /** Antes do paint, para o cronômetro nunca formatar corrida (MM:SS) durante natação. */
  useLayoutEffect(() => {
    tipoProvaRef.current = tipoProva;
  }, [tipoProva]);
  const modalityTime: TafModality =
    tipoProva === 'natacao' || tipoProva === 'abdominal_prancha' ? 'natacao' : 'corrida';
  const { formatMs, parseInput } = useTafTimeFormat(modalityTime);
  /** Sempre o `formatMs` da modalidade atual (corrida e natação: MM:SS). */
  const formatMsDisplayRef = useRef(formatMs);
  formatMsDisplayRef.current = formatMs;
  const [corridaEtapa, setCorridaEtapa] = useState<CorridaEtapa>('menu');
  const [numeroParticipantesCorrida, setNumeroParticipantesCorrida] = useState('');
  const [erroParticipantes, setErroParticipantes] = useState('');
  const [nParticipantesConfirmado, setNParticipantesConfirmado] = useState(0);
  const [nipsParticipantes, setNipsParticipantes] = useState<string[]>([]);
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
  const [numeroVoltas, setNumeroVoltas] = useState('');
  /** Voltas, chegadas e tempos em um único reducer (atualização atômica por clique). */
  const [trialTable, dispatchTrial] = useReducer(aplicarTafTrialReducer, initialTrialTableState);
  const { checksVoltas, chegadaNatacao, temposMilitaresMs } = trialTable;

  /** Após “Aplicar Resultado”: tempos gravados no cadastro. */
  const [salvandoResultadosCorrida, setSalvandoResultadosCorrida] = useState(false);
  const [modalTempoRegistradoVisible, setModalTempoRegistradoVisible] = useState(false);
  const [modalParcialAviso, setModalParcialAviso] = useState<string | null>(null);
  const pendingResultadosNavRef = useRef<ResultadoCorridaItem[] | null>(null);
  const resultadosPosMilitaresRef = useRef<ResultadoCorridaItem[] | null>(null);
  /**
   * Gravação adiada: nada é lançado no sistema (nem notas no cadastro, nem a sessão)
   * até o aplicador confirmar senha + rúbrica. Estes buffers guardam o que será gravado.
   */
  const pendingCadastrosRef = useRef<CadastroItemPersist[]>([]);
  const pendingCleanupsRef = useRef<Array<() => Promise<void>>>([]);
  /** Lista espelhada em estado para o modal de rúbrica re-renderizar ao mudar o participante. */
  const [listaResultadosRubricaNatacao, setListaResultadosRubricaNatacao] = useState<
    ResultadoCorridaItem[] | null
  >(null);
  const [modalRubricaNatacaoVisible, setModalRubricaNatacaoVisible] = useState(false);
  const [fluxoAplicadorVisible, setFluxoAplicadorVisible] = useState(false);
  const [indiceRubricaNatacao, setIndiceRubricaNatacao] = useState(0);
  const [, setRubricasNatacaoSvg] = useState<string[]>([]);
  const [erroRubricaNatacao, setErroRubricaNatacao] = useState('');
  const [rubricaStrokes, setRubricaStrokes] = useState<RubricaStroke[]>([]);
  const [rubricaStrokeAtual, setRubricaStrokeAtual] = useState<RubricaStroke>([]);
  const [rubricaCanvasWidth, setRubricaCanvasWidth] = useState(420);

  const [cronometroEstado, setCronometroEstado] = useState<CronometroCorridaEstado>('inicial');
  const [tempoExibido, setTempoExibido] = useState('00:00');
  /** Edição manual do tempo enquanto o cronômetro está pausado (MM:SS ou HH:MM:SS). */
  const [cronometroPausadoTexto, setCronometroPausadoTexto] = useState('00:00');
  const cronometroPausadoTextoRef = useRef('00:00');
  const cronometroInicioRef = useRef<number | null>(null);
  /** Ms já decorridos antes do trecho atual (somados a cada pausa). */
  const segmentoAcumuladoMsRef = useRef(0);
  /** Tempo final (ms) após “Parar corrida” — usado ao marcar última volta com corrida parada. */
  const tempoParadoMsRef = useRef<number | null>(null);
  const cronometroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permanenciaLimiteAtingidoRef = useRef(false);

  const [resultadoPermanenciaLinhas, setResultadoPermanenciaLinhas] = useState<
    ResultadoPermanenciaOpcao[]
  >([]);
  const [modalPermanenciaFinalizadaVisible, setModalPermanenciaFinalizadaVisible] =
    useState(false);
  const [erroPermanencia, setErroPermanencia] = useState('');

  const finalizarPermanenciaPorTempo = useCallback(() => {
    if (permanenciaLimiteAtingidoRef.current) return;
    permanenciaLimiteAtingidoRef.current = true;
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    cronometroInicioRef.current = null;
    segmentoAcumuladoMsRef.current = PERMANENCIA_DURACAO_MS;
    tempoParadoMsRef.current = PERMANENCIA_DURACAO_MS;
    const fmt = formatMs(PERMANENCIA_DURACAO_MS);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
    setCronometroEstado('finalizado');
    setModalPermanenciaFinalizadaVisible(true);
  }, [formatMs]);

  const tickCronometroDisplay = useCallback(() => {
    if (cronometroInicioRef.current == null) return;
    const ms = segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    if (tipoProvaRef.current === 'permanencia' && ms >= PERMANENCIA_DURACAO_MS) {
      finalizarPermanenciaPorTempo();
      return;
    }
    setTempoExibido(formatMsDisplayRef.current(ms));
  }, [finalizarPermanenciaPorTempo]);

  const getElapsedRaceMs = useCallback((): number | null => {
    const mod: TafModality = modalityTime;
    if (cronometroEstado === 'rodando' && cronometroInicioRef.current != null) {
      return segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    }
    if (cronometroEstado === 'pausado') {
      const parsed = parseTafPerformanceInput(mod, cronometroPausadoTextoRef.current.trim());
      if (parsed != null) return parsed;
      return segmentoAcumuladoMsRef.current;
    }
    if (cronometroEstado === 'finalizado' && tempoParadoMsRef.current != null) {
      return tempoParadoMsRef.current;
    }
    return null;
  }, [cronometroEstado, modalityTime]);

  const aplicarTempoCronometroPausado = useCallback((): boolean => {
    const ms = parseInput(cronometroPausadoTexto.trim());
    if (ms == null) {
      Alert.alert(
        'Tempo inválido',
        'Use MM:SS ou HH:MM:SS (ex.: 01:30 ou 01:05:30). Segundos entre 00 e 59.',
      );
      return false;
    }
    segmentoAcumuladoMsRef.current = ms;
    const fmt = formatMs(ms);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
    return true;
  }, [cronometroPausadoTexto, parseInput, formatMs, tipoProva]);

  const onCronometroPausadoTextoChange = useCallback((text: string) => {
    setCronometroPausadoTexto(text);
    cronometroPausadoTextoRef.current = text;
  }, []);

  /** Ao sair do campo: aplica tempo válido ou restaura o último valor do ref (sem alerta). */
  const onBlurCronometroPausado = useCallback(() => {
    const ms = parseInput(cronometroPausadoTexto.trim());
    if (ms == null) {
      const cur = formatMs(segmentoAcumuladoMsRef.current);
      setCronometroPausadoTexto(cur);
      cronometroPausadoTextoRef.current = cur;
      return;
    }
    segmentoAcumuladoMsRef.current = ms;
    const fmt = formatMs(ms);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
  }, [cronometroPausadoTexto, parseInput, formatMs]);

  const resetCronometroCorrida = useCallback(() => {
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    cronometroInicioRef.current = null;
    segmentoAcumuladoMsRef.current = 0;
    tempoParadoMsRef.current = null;
    permanenciaLimiteAtingidoRef.current = false;
    setCronometroEstado('inicial');
    const z = formatMsDisplayRef.current(0);
    setTempoExibido(z);
    setCronometroPausadoTexto(z);
    cronometroPausadoTextoRef.current = z;
  }, []);

  const iniciarCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'inicial' && cronometroEstado !== 'finalizado') return;
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    segmentoAcumuladoMsRef.current = 0;
    cronometroInicioRef.current = Date.now();
    tempoParadoMsRef.current = null;
    setCronometroEstado('rodando');
    const zero = formatMs(0);
    setTempoExibido(zero);
    setCronometroPausadoTexto(zero);
    cronometroPausadoTextoRef.current = zero;
    cronometroIntervalRef.current = setInterval(tickCronometroDisplay, 1000);
  }, [cronometroEstado, tickCronometroDisplay, formatMs]);

  const pausarCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'rodando' || cronometroInicioRef.current == null) return;
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    segmentoAcumuladoMsRef.current += Date.now() - cronometroInicioRef.current;
    cronometroInicioRef.current = null;
    const fmt = formatMs(segmentoAcumuladoMsRef.current);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
    setCronometroEstado('pausado');
  }, [cronometroEstado, formatMs]);

  const continuarCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'pausado') return;
    if (!aplicarTempoCronometroPausado()) return;
    cronometroInicioRef.current = Date.now();
    setCronometroEstado('rodando');
    tickCronometroDisplay();
    cronometroIntervalRef.current = setInterval(tickCronometroDisplay, 1000);
  }, [cronometroEstado, tickCronometroDisplay, aplicarTempoCronometroPausado]);

  const pararCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'rodando' && cronometroEstado !== 'pausado') return;
    if (cronometroEstado === 'pausado' && !aplicarTempoCronometroPausado()) return;
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    let totalMs = segmentoAcumuladoMsRef.current;
    if (cronometroEstado === 'rodando' && cronometroInicioRef.current != null) {
      totalMs += Date.now() - cronometroInicioRef.current;
    }
    cronometroInicioRef.current = null;
    segmentoAcumuladoMsRef.current = 0;
    tempoParadoMsRef.current = totalMs;
    const fmtParado = formatMsDisplayRef.current(totalMs);
    setTempoExibido(fmtParado);
    setCronometroPausadoTexto(fmtParado);
    cronometroPausadoTextoRef.current = fmtParado;
    setCronometroEstado('finalizado');
  }, [cronometroEstado, aplicarTempoCronometroPausado]);

  useEffect(() => {
    return () => {
      if (cronometroIntervalRef.current) {
        clearInterval(cronometroIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => subscribeModoDemonstracao(() => setDemoAtivo(isModoDemonstracaoAtivo())), []);

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
    tipoProva === 'natacao' || tipoProva === 'abdominal_prancha'
      ? true
      : mostrarColunaTempoCorrida;

  /** Nota corrida: exige coluna de tempo visível. */
  const mostrarColunaNotaCorrida = tipoProva === 'corrida' && mostrarColunaTempo;
  const mostrarColunaNotaCaminhada = tipoProva === 'caminhada' && mostrarColunaTempo;
  const mostrarColunaNotaNatacao = tipoProva === 'natacao';
  const mostrarColunaNotaPrancha = tipoProva === 'abdominal_prancha';

  const notaCorridaPorLinha = useMemo(() => {
    if (!mostrarColunaNotaCorrida) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
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

  /** Todos com tempo registrado (corrida: última volta; natação: chegada). */
  const todosIntegrantesComTempoRegistrado = useMemo(() => {
    const p = nParticipantesConfirmado;
    if (p < 1) return false;
    if (tipoProva === 'natacao' || tipoProva === 'abdominal_prancha') {
      if (temposMilitaresMs.length < p) return false;
      for (let i = 0; i < p; i += 1) {
        if (temposMilitaresMs[i] == null) return false;
      }
      return true;
    }
    if (nColunasVoltas < 1) return false;
    if (temposMilitaresMs.length < p) return false;
    for (let i = 0; i < p; i += 1) {
      if (temposMilitaresMs[i] == null) return false;
    }
    return true;
  }, [tipoProva, nParticipantesConfirmado, nColunasVoltas, temposMilitaresMs]);

  /** Quando o último militar recebe tempo, encerra o cronômetro automaticamente. */
  useEffect(() => {
    if (!todosIntegrantesComTempoRegistrado) return;
    if (cronometroEstado !== 'rodando' && cronometroEstado !== 'pausado') return;
    const mod: TafModality = tipoProva === 'natacao' ? 'natacao' : 'corrida';
    if (cronometroEstado === 'pausado') {
      const parsed = parseTafPerformanceInput(
        mod,
        cronometroPausadoTextoRef.current.trim(),
      );
      if (parsed != null) segmentoAcumuladoMsRef.current = parsed;
    }
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    let totalMs = segmentoAcumuladoMsRef.current;
    if (cronometroEstado === 'rodando' && cronometroInicioRef.current != null) {
      totalMs += Date.now() - cronometroInicioRef.current;
    }
    cronometroInicioRef.current = null;
    segmentoAcumuladoMsRef.current = 0;
    tempoParadoMsRef.current = totalMs;
    const fmt = formatMsDisplayRef.current(totalMs);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
    setCronometroEstado('finalizado');
  }, [todosIntegrantesComTempoRegistrado, cronometroEstado, tipoProva]);

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
    if (corridaEtapa !== 'tabela_corrida') return;
    dispatchTrial({ type: 'resizeTempos', p: nParticipantesConfirmado });
  }, [corridaEtapa, nParticipantesConfirmado]);

  const toggleCheckVolta = useCallback(
    (participante: number, volta: number) => {
      const isLastVolta = nColunasVoltas > 0 && volta === nColunasVoltas - 1;
      const elapsedMs = isLastVolta ? getElapsedRaceMs() : null;
      dispatchTrial({
        type: 'toggleVoltaCorrida',
        participante,
        volta,
        isLastVolta,
        elapsedMs,
      });
    },
    [nColunasVoltas, getElapsedRaceMs],
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

  const limparBufferAplicacao = useCallback(() => {
    pendingCadastrosRef.current = [];
    pendingCleanupsRef.current = [];
    resultadosPosMilitaresRef.current = null;
  }, []);

  const gravarSessaoAplicacao = useCallback(
    async (
      resultados: ResultadoCorridaItem[],
      assinatura?: AplicadorAssinaturaResumo,
    ): Promise<string | undefined> => {
      const tipo = tipoProvaRef.current ?? tipoProva;
      if (!tipo || resultados.length === 0) return undefined;

      const indicesRepeticao = nipsRepeticaoAutorizadaRef.current;
      if (indicesRepeticao.size > 0) {
        for (const i of indicesRepeticao) {
          const nip = (resultados[i]?.nip ?? nipsParticipantes[i] ?? '').trim();
          if (nip) {
            await removerParticipanteModalidadeDoHistorico(nip, tipo);
          }
        }
        nipsRepeticaoAutorizadaRef.current = new Set();
      }

      return addSessaoAplicacao({
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
   * Grava DE FATO no sistema tudo que estava pendente (notas no cadastro, limpezas de
   * histórico e a sessão) — somente após o aplicador confirmar senha + rúbrica.
   */
  const commitAplicacao = useCallback(
    async (
      resultados: ResultadoCorridaItem[],
      assinatura: AplicadorAssinaturaResumo,
    ): Promise<void> => {
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

      await gravarSessaoAplicacao(resultados, assinatura);
    },
    [gravarSessaoAplicacao],
  );

  const iniciarFinalizacaoComAssinaturaAplicador = useCallback(
    (resultados: ResultadoCorridaItem[]) => {
      resultadosPosMilitaresRef.current = resultados;
      setFluxoAplicadorVisible(true);
    },
    [],
  );

  const onConcluirAssinaturaAplicador = useCallback(
    async (assinatura: AplicadorAssinaturaResumo) => {
      const res = resultadosPosMilitaresRef.current;
      try {
        if (res) {
          await commitAplicacao(res, assinatura);
        }
      } catch {
        Alert.alert(
          'Erro ao lançar',
          'Não foi possível lançar os resultados no sistema. Tente novamente.',
        );
        return;
      }
      limparBufferAplicacao();
      setFluxoAplicadorVisible(false);
      if (res) {
        navigation.navigate('CadastrarResultados', {
          resultados: res,
          aplicadorAssinatura: assinatura,
          returnTo: 'AplicarTAF',
        });
      }
    },
    [navigation, commitAplicacao, limparBufferAplicacao],
  );

  const onCancelarAssinaturaAplicador = useCallback(() => {
    Alert.alert(
      'Descartar aplicação?',
      'Enquanto o aplicador não confirmar a senha e a rúbrica, nada é lançado no sistema. Deseja descartar esta aplicação?',
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Descartar',
          style: 'destructive',
          onPress: () => {
            limparBufferAplicacao();
            setFluxoAplicadorVisible(false);
          },
        },
      ],
    );
  }, [limparBufferAplicacao]);

  const onCadastrarResultados = useCallback(async () => {
    if (salvandoResultadosCorrida) return;
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
    const prova = tipoProva;
    const labelAtletaLocal = labelAtletaProva(prova);

    let cadastrosInicial: CadastroItemPersist[] = [];
    try {
      cadastrosInicial = await getAllCadastros();
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
        reprovacaoTexto: notaTexto === 'REPROVADO' ? 'Reprovado' : undefined,
      });
    }

    setSalvandoResultadosCorrida(true);
    try {
      // Gravação adiada: monta o que será lançado, mas só grava após o aplicador confirmar.
      const bufferCadastros: CadastroItemPersist[] = [];
      const bufferCleanups: Array<() => Promise<void>> = [];
      const listaAtual: CadastroItemPersist[] = [...cadastrosInicial];
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
        const atualizado = aplicarResultadoNoCadastro(busca.cadastro, prova, {
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

      if (ok > 0) {
        const avisoParcial =
          naoEncontrados.length > 0
            ? `Registro parcial: não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`
            : null;
        const usaRubrica =
          prova === 'natacao' ||
          prova === 'corrida' ||
          prova === 'caminhada' ||
          prova === 'abdominal_prancha';
        if (usaRubrica && resultados.length > 0) {
          setModalParcialAviso(avisoParcial);
          setRubricasNatacaoSvg(Array.from({ length: resultados.length }, () => ''));
          setIndiceRubricaNatacao(0);
          setErroRubricaNatacao('');
          setRubricaStrokes([]);
          setRubricaStrokeAtual([]);
          const copiaResultados = resultados.map((r) => ({ ...r }));
          setListaResultadosRubricaNatacao(copiaResultados);
          pendingResultadosNavRef.current = copiaResultados;
          setCorridaEtapa('nips');
          setModalRubricaNatacaoVisible(true);
        } else {
          setModalParcialAviso(avisoParcial);
          setCorridaEtapa('nips');
          setModalTempoRegistradoVisible(true);
        }
      } else {
        Alert.alert(
          'Nenhum registro',
          `Não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                void iniciarFinalizacaoComAssinaturaAplicador(resultados);
              },
            },
          ],
        );
        pendingResultadosNavRef.current = null;
      }
    } catch {
      pendingResultadosNavRef.current = null;
      Alert.alert(
        'Erro',
        'Não foi possível gravar os tempos. Verifique se o cadastro está disponível (IndexedDB no navegador).',
        [
          {
            text: 'OK',
            onPress: () => {
              void iniciarFinalizacaoComAssinaturaAplicador(resultados);
            },
          },
        ],
      );
    } finally {
      setSalvandoResultadosCorrida(false);
    }
  }, [
    navigation,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    salvandoResultadosCorrida,
    temposMilitaresMs,
    tipoProva,
    gravarSessaoAplicacao,
    iniciarFinalizacaoComAssinaturaAplicador,
    modoTafNaval,
  ]);

  const onCadastrarRepeticoes = useCallback(async () => {
    if (salvandoResultadosCorrida) return;
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return;

    const prova = tipoProva;
    const labelAtletaLocal = labelAtletaProva(prova);

    let cadastrosInicial: CadastroItemPersist[] = [];
    try {
      cadastrosInicial = await getAllCadastros();
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
        reprovacaoTexto: notaTexto === 'REPROVADO' ? 'Reprovado' : undefined,
      });
    }

    setSalvandoResultadosCorrida(true);
    try {
      // Gravação adiada: monta o que será lançado, mas só grava após o aplicador confirmar.
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
          'Nenhum registro',
          `Não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`,
          [
            {
              text: 'OK',
              onPress: () => {
                void iniciarFinalizacaoComAssinaturaAplicador(resultados);
              },
            },
          ],
        );
        pendingResultadosNavRef.current = null;
      }
    } catch {
      pendingResultadosNavRef.current = null;
      Alert.alert('Erro', 'Não foi possível gravar as repetições. Tente novamente.');
    } finally {
      setSalvandoResultadosCorrida(false);
    }
  }, [
    navigation,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    repeticoesParticipantes,
    salvandoResultadosCorrida,
    tipoProva,
    gravarSessaoAplicacao,
    iniciarFinalizacaoComAssinaturaAplicador,
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

  const iniciarRubricaStroke = useCallback((event: GestureResponderEvent) => {
    const { locationX, locationY } = event.nativeEvent;
    setErroRubricaNatacao('');
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

  const limparRubricaNatacaoAtual = useCallback(() => {
    setErroRubricaNatacao('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
  }, []);

  const confirmarRubricaNatacao = useCallback(() => {
    const strokesProntos = [
      ...rubricaStrokes.filter((s) => s.length > 0),
      ...(rubricaStrokeAtual.length > 0 ? [rubricaStrokeAtual] : []),
    ];
    if (strokesProntos.length === 0) {
      setErroRubricaNatacao('Desenhe a rúbrica do candidato para continuar.');
      return;
    }
    const rubricaSvgAtual = buildRubricaSvgDataUrl(
      strokesProntos,
      rubricaCanvasWidth,
      RUBRICA_NATIVA_ALTURA,
      RUBRICA_COR_TRACO,
      RUBRICA_COR_FUNDO,
    );
    const res = listaResultadosRubricaNatacao ?? pendingResultadosNavRef.current;
    if (!res || res.length === 0) {
      setModalRubricaNatacaoVisible(false);
      setIndiceRubricaNatacao(0);
      setListaResultadosRubricaNatacao(null);
      setRubricasNatacaoSvg([]);
      setErroRubricaNatacao('');
      setRubricaStrokes([]);
      setRubricaStrokeAtual([]);
      return;
    }
    const atualizados = res.map((item, idx) =>
      idx === indiceRubricaNatacao
        ? { ...item, rubricaCandidato: 'Rúbrica capturada', rubricaCandidatoSvg: rubricaSvgAtual }
        : item,
    );
    setRubricasNatacaoSvg((prev) => {
      const next = [...prev];
      next[indiceRubricaNatacao] = rubricaSvgAtual;
      return next;
    });
    pendingResultadosNavRef.current = atualizados;
    setListaResultadosRubricaNatacao(atualizados);
    const proximo = indiceRubricaNatacao + 1;
    if (proximo < atualizados.length) {
      setIndiceRubricaNatacao(proximo);
      setErroRubricaNatacao('');
      return;
    }
    setModalRubricaNatacaoVisible(false);
    setIndiceRubricaNatacao(0);
    setListaResultadosRubricaNatacao(null);
    setRubricasNatacaoSvg([]);
    setErroRubricaNatacao('');
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    if (modalParcialAviso) {
      Alert.alert('Registro parcial', modalParcialAviso);
    }
    // Mescla a rúbrica do candidato no buffer (ainda sem gravar);
    // a gravação real ocorre só após o aplicador confirmar senha + rúbrica.
    pendingCadastrosRef.current = aplicarRubricasEmCadastros(
      pendingCadastrosRef.current,
      atualizados,
    );
    iniciarFinalizacaoComAssinaturaAplicador(atualizados);
    pendingResultadosNavRef.current = null;
    setModalParcialAviso(null);
  }, [
    indiceRubricaNatacao,
    listaResultadosRubricaNatacao,
    modalParcialAviso,
    iniciarFinalizacaoComAssinaturaAplicador,
    rubricaCanvasWidth,
    rubricaStrokeAtual,
    rubricaStrokes,
  ]);

  /** Ao trocar de participante ou abrir o modal: limpa a área de assinatura para não misturar traços. */
  useEffect(() => {
    if (!modalRubricaNatacaoVisible) return;
    setRubricaStrokes([]);
    setRubricaStrokeAtual([]);
    setErroRubricaNatacao('');
  }, [indiceRubricaNatacao, modalRubricaNatacaoVisible]);

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

  const onChangeParticipantes = useCallback((text: string) => {
    const apenasDigitos = text.replace(/\D/g, '');
    setNumeroParticipantesCorrida(apenasDigitos);
    setErroParticipantes('');
  }, []);

  const abrirCorrida = useCallback(() => {
    tipoProvaRef.current = 'corrida';
    setTipoProva('corrida');
    setCorridaEtapa('participantes');
  }, []);

  const abrirNatacao = useCallback(() => {
    tipoProvaRef.current = 'natacao';
    setTipoProva('natacao');
    setCorridaEtapa('participantes');
  }, []);

  const abrirPermanencia = useCallback(() => {
    tipoProvaRef.current = 'permanencia';
    setTipoProva('permanencia');
    setCorridaEtapa('participantes');
  }, []);

  const abrirCaminhada = useCallback(() => {
    tipoProvaRef.current = 'caminhada';
    setTipoProva('caminhada');
    setCorridaEtapa('participantes');
  }, []);

  const abrirFlexaoBarra = useCallback(() => {
    tipoProvaRef.current = 'flexao_barra';
    setTipoProva('flexao_barra');
    setCorridaEtapa('participantes');
  }, []);

  const abrirFlexaoSolo = useCallback(() => {
    tipoProvaRef.current = 'flexao_solo';
    setTipoProva('flexao_solo');
    setCorridaEtapa('participantes');
  }, []);

  const abrirAbdominalRemador = useCallback(() => {
    tipoProvaRef.current = 'abdominal_remador';
    setTipoProva('abdominal_remador');
    setCorridaEtapa('participantes');
  }, []);

  const abrirAbdominalPrancha = useCallback(() => {
    tipoProvaRef.current = 'abdominal_prancha';
    setTipoProva('abdominal_prancha');
    setCorridaEtapa('participantes');
  }, []);

  const voltarMenuProvas = useCallback(() => {
    tipoProvaRef.current = null;
    setTipoProva(null);
    setCorridaEtapa('menu');
  }, []);

  const voltarParticipantes = useCallback(() => {
    setCorridaEtapa('participantes');
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
  }, []);

  const confirmarParticipantes = useCallback(() => {
    const n = parseInt(numeroParticipantesCorrida, 10);
    const limite = modoPreCadastro
      ? limiteParticipantesPreCadastro(tipoProva)
      : MAX_PARTICIPANTES;
    if (!Number.isFinite(n) || n < 1) {
      setErroParticipantes('Informe um número válido (mínimo 1).');
      return;
    }
    if (n > limite) {
      setErroParticipantes(
        modoPreCadastro && tipoProva !== 'caminhada'
          ? `Máximo de ${MAX_PRE_CADASTRO_PARTICIPANTES} participantes no pré-cadastro.`
          : `Máximo de ${MAX_PARTICIPANTES} participantes.`,
      );
      return;
    }
    setErroParticipantes('');
    setNParticipantesConfirmado(n);
    setNipsParticipantes(Array.from({ length: n }, () => ''));
    setNipFeedbackLinhas(Array.from({ length: n }, () => null));
    setCorridaEtapa('nips');
  }, [numeroParticipantesCorrida, modoPreCadastro, tipoProva]);

  const definirNipOk = useCallback((index: number, c: CadastroItemPersist) => {
    const nome = (c.nome || '').trim() || 'Sem nome';
    setNipFeedbackLinhas((prev) => {
      const next = [...prev];
      next[index] = {
        tipo: 'ok',
        texto: 'Militar Cadastrado no Sistema.',
        nomeMilitar: nome,
        dataNascimento: c.dataNascimento || '',
        sexo: c.sexo,
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

      const nome = (c.nome || '').trim() || 'Sem nome';
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
      if (cadastroPrecisaCompletarDadosTaf(c)) {
        const nome = (c.nome || '').trim() || 'Sem nome';
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          next[index] = {
            tipo: 'completar_dados',
            nomeMilitar: nome,
            cadastro: c,
            dataNascimento: (c.dataNascimento || '').trim(),
            sexo: c.sexo === 'F' ? 'F' : 'M',
          };
          return next;
        });
        return;
      }

      const nome = (c.nome || '').trim() || 'Sem nome';
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
          getAllCadastros(),
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
    (index: number, patch: Partial<{ dataNascimento: string; sexo: 'M' | 'F' }>) => {
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
      const fb = nipFeedbackLinhas[index];
      if (fb?.tipo !== 'completar_dados') return;

      const dataNasc = fb.dataNascimento.trim();
      if (!dataNascimentoCadastroValida(dataNasc)) {
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          const cur = prev[index];
          if (cur?.tipo !== 'completar_dados') return prev;
          next[index] = {
            ...cur,
            erro: 'Informe a data de nascimento no formato DD/MM/AAAA.',
          };
          return next;
        });
        return;
      }

      const atualizado: CadastroItemPersist = {
        ...fb.cadastro,
        dataNascimento: dataNasc,
        sexo: fb.sexo,
      };

      try {
        await addCadastro(atualizado);
      } catch {
        setNipFeedbackLinhas((prev) => {
          const next = [...prev];
          const cur = prev[index];
          if (cur?.tipo !== 'completar_dados') return prev;
          next[index] = {
            ...cur,
            erro: 'Não foi possível salvar os dados. Tente novamente.',
          };
          return next;
        });
        return;
      }

      await continuarAposCadastroEncontrado(index, atualizado);
    },
    [nipFeedbackLinhas, continuarAposCadastroEncontrado],
  );

  const atualizarNip = useCallback((index: number, texto: string) => {
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

    const cadastros = await getAllCadastros();
    const resultado = buscarCadastroPorNomeOuNip(cadastros, nip);

    if (resultado.kind !== 'found') {
      setNipFeedbackLinhas((prev) => {
        const next = [...prev];
        if (resultado.kind === 'none') {
          next[index] = {
            tipo: 'erro',
            texto: 'Este militar precisa ser cadastrado na página Cadastro.',
          };
        } else {
          next[index] = {
            tipo: 'erro',
            texto:
              'Vários cadastros correspondem à busca. Informe o NIP completo (8 dígitos).',
          };
        }
        return next;
      });
      return;
    }

    const c = resultado.cadastro;
    await continuarAposCadastroEncontrado(index, c);
  }, [nipsParticipantes, continuarAposCadastroEncontrado]);

  const preencherNipsDemonstracao = useCallback(async () => {
    if (preenchendoNipsDemo || nParticipantesConfirmado < 1) return;
    setPreenchendoNipsDemo(true);
    try {
      const cadastros = await getAllCadastros();
      const pool = filtrarCadastrosDemonstracao(cadastros, modoTafNaval);
      const n = nParticipantesConfirmado;
      if (pool.length < n) {
        Alert.alert(
          'Cadastros insuficientes',
          `Há ${pool.length} militar(es) de exemplo disponível(is) para esta prova. Reduza o número de participantes.`,
        );
        return;
      }
      const selecionados = pool.slice(0, n);
      setNipsParticipantes(selecionados.map((c) => c.nip));
      setNipFeedbackLinhas(selecionados.map((c) => nipFeedbackOkFromCadastro(c)));
      nipsRepeticaoAutorizadaRef.current = new Set(Array.from({ length: n }, (_, i) => i));
      setModalTesteExistente(null);
      setModalModalidadeExcludente(null);
    } finally {
      setPreenchendoNipsDemo(false);
    }
  }, [modoTafNaval, nParticipantesConfirmado, preenchendoNipsDemo]);

  const fecharModalTesteExistente = useCallback(() => {
    setModalTesteExistente(null);
  }, []);

  const confirmarRepeticaoTeste = useCallback(async () => {
    if (!modalTesteExistente) return;
    const { index, nip } = modalTesteExistente;
    nipsRepeticaoAutorizadaRef.current.add(index);
    const cadastros = await getAllCadastros();
    const busca = buscarCadastroPorNomeOuNip(cadastros, nip);
    if (busca.kind === 'found') {
      definirNipOk(index, busca.cadastro);
    }
    setModalTesteExistente(null);
  }, [modalTesteExistente, definirNipOk]);

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
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (OK em cada linha) e preencha data de nascimento e gênero quando solicitado.',
        );
        return;
      }
    }
    resetCronometroCorrida();
    dispatchTrial({
      type: 'prepararProva',
      nParticipantes: nParticipantesConfirmado,
      tipoProva: trialTipoFromProva(tipoProva),
    });
    setCorridaEtapa('tabela_corrida');
  }, [resetCronometroCorrida, nParticipantesConfirmado, tipoProva, nipFeedbackLinhas]);

  const prepararProvaRepeticoes = useCallback(() => {
    if (!tipoProva || !isProvaComRepeticoes(tipoProva)) return;
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (OK em cada linha) e preencha data de nascimento e gênero quando solicitado.',
        );
        return;
      }
    }
    setRepeticoesParticipantes(Array.from({ length: nParticipantesConfirmado }, () => ''));
    setCorridaEtapa('tabela_repeticoes');
  }, [nParticipantesConfirmado, tipoProva, nipFeedbackLinhas]);

  const prepararPermanencia = useCallback(() => {
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (OK em cada linha) e preencha data de nascimento e gênero quando solicitado.',
        );
        return;
      }
    }
    permanenciaLimiteAtingidoRef.current = false;
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    setResultadoPermanenciaLinhas(
      Array.from({ length: nParticipantesConfirmado }, () => null),
    );
    resetCronometroCorrida();
    setCorridaEtapa('tabela_permanencia');
  }, [nParticipantesConfirmado, nipFeedbackLinhas, resetCronometroCorrida]);

  const togglePermanenciaResultado = useCallback(
    (index: number, opcao: 'aprovado' | 'reprovado') => {
      setErroPermanencia('');
      setResultadoPermanenciaLinhas((prev) => {
        const next = [...prev];
        next[index] = prev[index] === opcao ? null : opcao;
        return next;
      });
    },
    [],
  );

  const onCadastrarPermanencia = useCallback(async () => {
    const faltam = resultadoPermanenciaLinhas.findIndex(
      (r) => r !== 'aprovado' && r !== 'reprovado',
    );
    if (faltam >= 0) {
      setErroPermanencia('Marque Aprovado ou Reprovado para todos os participantes.');
      return;
    }
    setErroPermanencia('');
    setSalvandoResultadosCorrida(true);
    const tempoMs =
      tempoParadoMsRef.current ??
      segmentoAcumuladoMsRef.current ??
      PERMANENCIA_DURACAO_MS;
    const tempoStr = formatMsByModality('corrida', tempoMs);

    try {
      let cadastrosInicial = await getAllCadastros();
      // Gravação adiada: monta o que será lançado, mas só grava após o aplicador confirmar.
      const bufferCadastros: CadastroItemPersist[] = [];
      const listaAtual = [...cadastrosInicial];
      let ok = 0;
      const naoEncontrados: string[] = [];

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

      if (ok > 0) {
        const resultadosPerm: ResultadoCorridaItem[] = [];
        for (let i = 0; i < nParticipantesConfirmado; i += 1) {
          const fb = nipFeedbackLinhas[i];
          const nip = nipsParticipantes[i] ?? '';
          const resultado = resultadoPermanenciaLinhas[i]!;
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
        pendingResultadosNavRef.current = resultadosPerm;

        const aviso =
          naoEncontrados.length > 0
            ? `Registro parcial: não localizado no cadastro: ${naoEncontrados.slice(0, 3).join(', ')}${naoEncontrados.length > 3 ? '…' : ''}.`
            : null;
        setModalParcialAviso(aviso);
        setRubricasNatacaoSvg(Array.from({ length: resultadosPerm.length }, () => ''));
        setIndiceRubricaNatacao(0);
        setErroRubricaNatacao('');
        setRubricaStrokes([]);
        setRubricaStrokeAtual([]);
        const copiaPerm = resultadosPerm.map((r) => ({ ...r }));
        setListaResultadosRubricaNatacao(copiaPerm);
        pendingResultadosNavRef.current = copiaPerm;
        setCorridaEtapa('nips');
        setModalRubricaNatacaoVisible(true);
      } else {
        Alert.alert(
          'Nenhum registro salvo',
          'Não foi possível localizar os militares no cadastro.',
        );
      }
    } finally {
      setSalvandoResultadosCorrida(false);
    }
  }, [
    resultadoPermanenciaLinhas,
    nParticipantesConfirmado,
    nipsParticipantes,
    nipFeedbackLinhas,
    formatMs,
  ]);

  const voltarDeTabelaParaNips = useCallback(() => {
    resetCronometroCorrida();
    setRepeticoesParticipantes([]);
    setCorridaEtapa('nips');
  }, [resetCronometroCorrida]);

  const recarregarListaPreCadastros = useCallback(async () => {
    const lista = await getAllPreCadastrosTaf();
    setListaPreCadastros(lista);
  }, []);

  const abrirListaPreCadastro = useCallback(() => {
    void recarregarListaPreCadastros().then(() => {
      setMostrarListaPreCadastro(true);
      setModoPreCadastro(false);
      setModoTafNaval(false);
      setMostrarProvas(false);
    });
  }, [recarregarListaPreCadastros]);

  const voltarInicioAplicarTaf = useCallback(() => {
    setMostrarListaPreCadastro(false);
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
    setCorridaEtapa('menu');
  }, []);

  const iniciarNovoPreCadastro = useCallback(() => {
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setModoPreCadastro(true);
    setModoTafNaval(false);
    setMostrarListaPreCadastro(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setNumeroParticipantesCorrida('');
    setErroParticipantes('');
    setNParticipantesConfirmado(0);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas('');
    setResultadoPermanenciaLinhas([]);
    setModalPermanenciaFinalizadaVisible(false);
    setErroPermanencia('');
    dispatchTrial({ type: 'resetAll' });
  }, [resetCronometroCorrida]);

  const iniciarNovoPreCadastroCfn = useCallback(() => {
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setModoPreCadastro(true);
    setModoTafNaval(true);
    setMostrarListaPreCadastro(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setNumeroParticipantesCorrida('');
    setErroParticipantes('');
    setNParticipantesConfirmado(0);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas('');
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
    const item: PreCadastroTaf = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      criadoEm: Date.now(),
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
    setModoPreCadastro(false);
    setModoTafNaval(false);
    setMostrarProvas(false);
    setCorridaEtapa('menu');
    setTipoProva(null);
    tipoProvaRef.current = null;
    await recarregarListaPreCadastros();
    setMostrarListaPreCadastro(true);
    Alert.alert('Pré-cadastro salvo', 'Os participantes foram salvos. Use "Iniciar Prova" quando for aplicar o TAF.');
  }, [
    tipoProva,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    nipsParticipantes,
    recarregarListaPreCadastros,
    modoTafNaval,
  ]);

  const iniciarProvaFromPreCadastro = useCallback(
    (pre: PreCadastroTaf) => {
      const tipo = pre.tipoProva;
      const n = pre.participantes.length;
      if (n < 1) return;
      const normaCfn = (pre.normaTaf ?? 'armada') === 'cfn';

      tipoProvaRef.current = tipo;
      setTipoProva(tipo);
      setModoTafNaval(normaCfn);
      setModoPreCadastro(false);
      setMostrarListaPreCadastro(false);
      setMostrarProvas(true);
      setNumeroParticipantesCorrida(String(n));
      setNParticipantesConfirmado(n);
      setNipsParticipantes(pre.participantes.map((p) => p.nip));
      setNipFeedbackLinhas(
        pre.participantes.map((p) => ({
          tipo: 'ok' as const,
          texto: 'Militar Cadastrado no Sistema.',
          nomeMilitar: p.nomeMilitar,
          dataNascimento: p.dataNascimento,
          sexo: p.sexo,
        })),
      );
      nipsRepeticaoAutorizadaRef.current = new Set();
      setModalTesteExistente(null);
      setNumeroVoltas('');
      resetCronometroCorrida();

      if (tipo === 'permanencia') {
        permanenciaLimiteAtingidoRef.current = false;
        setModalPermanenciaFinalizadaVisible(false);
        setErroPermanencia('');
        setResultadoPermanenciaLinhas(Array.from({ length: n }, () => null));
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
    },
    [resetCronometroCorrida],
  );

  const excluirPreCadastro = useCallback((pre: PreCadastroTaf) => {
    setPreCadastroParaExcluir(pre);
  }, []);

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
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setNumeroParticipantesCorrida('');
    setErroParticipantes('');
    setNParticipantesConfirmado(0);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas('');
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
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setNumeroParticipantesCorrida('');
    setErroParticipantes('');
    setNParticipantesConfirmado(0);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    nipsRepeticaoAutorizadaRef.current = new Set();
    setModalTesteExistente(null);
    setNumeroVoltas('');
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
        return fb?.tipo === 'ok' ? fb.nomeMilitar : '—';
      }),
    [nParticipantesConfirmado, nipFeedbackLinhas],
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
    (index: number) => getNotaModal(index) === 'REPROVADO',
    [getNotaModal],
  );

  const flowHeader = useMemo(() => {
    if (mostrarListaPreCadastro) {
      return {
        title: 'Pré-cadastros',
        subtitle: 'Gerencie provas preparadas para iniciar com um toque',
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
      if (corridaEtapa === 'participantes') {
        return {
          title: tituloProvaCurta,
          subtitle: 'Defina quantos militares participarão',
        };
      }
      if (corridaEtapa === 'nips') {
        return {
          title: tituloProvaCurta,
          subtitle: `Confirme os NIPs de ${nParticipantesConfirmado} participante(s)`,
        };
      }
    }
    return {
      title: 'Aplicar TAF',
      subtitle: 'Provas com cronômetro integrado',
    };
  }, [
    mostrarListaPreCadastro,
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
        visible={modalTempoRegistradoVisible}
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
              Resultado registrado. Confirme a assinatura do aplicador para concluir o teste.
            </Text>
            {modalParcialAviso ? (
              <Text style={styles.modalTempoParcialCadastro}>{modalParcialAviso}</Text>
            ) : null}
            <AplicarTafPrimaryButton label="OK" onPress={fecharModalTempoRegistrado} />
          </View>
        </View>
      </AppModal>
      <AppModal
        visible={modalRubricaNatacaoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
        accessibilityViewIsModal
      >
        <AssinaturaFuturistaOverlay
          style={{
            paddingHorizontal: horizontalPad,
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <AssinaturaFuturistaScroll>
            {(() => {
              const lista = listaResultadosRubricaNatacao;
              const participanteAtual = lista?.[indiceRubricaNatacao];
              const totalLista = lista?.length ?? 0;
              if (!participanteAtual) return null;
              const modProva = participanteAtual.prova ?? 'corrida';
              const tituloModalidade =
                modProva === 'natacao'
                  ? 'Natação'
                  : modProva === 'permanencia'
                    ? 'Permanência'
                    : modProva === 'caminhada'
                      ? 'Caminhada'
                      : 'Corrida';
              const temTracoRubrica =
                rubricaStrokes.some((s) => s.length > 0) || rubricaStrokeAtual.length > 0;
              const tempoStr = formatMsByModality(
                modProva === 'natacao' ? 'natacao' : 'corrida',
                participanteAtual.tempoMs,
              );

              return (
                <AssinaturaFuturistaCard key={`rubrica-participante-${indiceRubricaNatacao}`} accent="cyan">
                  <AssinaturaFuturistaHeader
                    kicker="CANDIDATO"
                    title="Assinatura do candidato"
                    subtitle={`Participante ${indiceRubricaNatacao + 1} de ${totalLista} · ${tituloModalidade}`}
                    accent="cyan"
                  />

                  <AssinaturaFuturistaMetaChip
                    label="Militar"
                    value={`${participanteAtual.nome} · NIP ${participanteAtual.nip || '—'}`}
                  />
                  <AssinaturaFuturistaMetaChip
                    label="Resultado"
                    value={`Tempo ${tempoStr} · Nota ${textoNotaRubricaModal(participanteAtual)}`}
                  />

                  <AssinaturaFuturistaCanvas
                    accent="cyan"
                    height={RUBRICA_NATIVA_ALTURA}
                    onLayout={(e) => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0) setRubricaCanvasWidth(w);
                    }}
                    canvasProps={{
                      onStartShouldSetResponder: () => true,
                      onMoveShouldSetResponder: () => true,
                      onResponderTerminationRequest: () => false,
                      onResponderGrant: iniciarRubricaStroke,
                      onResponderMove: moverRubricaStroke,
                      onResponderRelease: finalizarRubricaStroke,
                      onResponderTerminate: finalizarRubricaStroke,
                    }}
                  >
                    <Svg width="100%" height={RUBRICA_NATIVA_ALTURA}>
                      {rubricaStrokes.map((stroke, idx) => (
                        <SvgPath
                          key={`stroke-${indiceRubricaNatacao}-${idx}`}
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

                  {erroRubricaNatacao ? (
                    <AssinaturaFuturistaError message={erroRubricaNatacao} />
                  ) : null}

                  <AssinaturaFuturistaBtnRow>
                    <AssinaturaFuturistaBtnGhost
                      label="Limpar"
                      onPress={limparRubricaNatacaoAtual}
                    />
                    <AssinaturaFuturistaBtnPrimary
                      label={indiceRubricaNatacao + 1 < totalLista ? 'Próximo' : 'Finalizar'}
                      onPress={confirmarRubricaNatacao}
                      disabled={!temTracoRubrica}
                      accent="cyan"
                      flex
                    />
                  </AssinaturaFuturistaBtnRow>
                </AssinaturaFuturistaCard>
              );
            })()}
          </AssinaturaFuturistaScroll>
        </AssinaturaFuturistaOverlay>
      </AppModal>

      <FluxoAssinaturaAplicadorModal
        visible={fluxoAplicadorVisible}
        onConcluir={(assinatura) => void onConcluirAssinaturaAplicador(assinatura)}
        onCancelar={onCancelarAssinaturaAplicador}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContentCadastro,
          { paddingHorizontal: horizontalPad, paddingBottom: scrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!modalRubricaNatacaoVisible && !fluxoAplicadorVisible}
      >
        <View style={styles.centerWrap}>
          {!mostrarProvas && !mostrarListaPreCadastro ? (
            <AplicarTafCenteredTabHeader
              title={flowHeader.title}
              subtitle={flowHeader.subtitle}
              footer={<TopActionIcons activeRoute="AplicarTAF" inline centered />}
            />
          ) : (
            <AplicarTafFlowHeader
              title={flowHeader.title}
              subtitle={flowHeader.subtitle}
              onBack={() => navigation.goBack()}
              right={
                mostrarProvas && corridaEtapa === 'nips' && demoAtivo ? (
                  <AplicarTafDemoNipsIconButton
                    onPress={() => void preencherNipsDemonstracao()}
                    loading={preenchendoNipsDemo}
                  />
                ) : undefined
              }
            />
          )}

          {!mostrarProvas && !mostrarListaPreCadastro ? (
            <AplicarTafHomeLauncher
              onIniciarTaf={iniciarTaf}
              onIniciarTafNaval={iniciarTafNaval}
              onPreCadastro={abrirListaPreCadastro}
            />
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
                    titulo={labelTipoProvaPreCadastro(pre)}
                    meta={metaPreCadastro(pre)}
                    nomesPreview={pre.participantes.map((p) => p.nomeMilitar).join(', ')}
                    accentColors={PRE_CADASTRO_ACCENTS[pre.tipoProva] ?? PRE_CADASTRO_ACCENTS.corrida}
                    onIniciar={() => iniciarProvaFromPreCadastro(pre)}
                    onExcluir={() => excluirPreCadastro(pre)}
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
                    ? modoTafNaval
                      ? 'PRÉ-CADASTRO CFN'
                      : 'PRÉ-CADASTRO ARMADA'
                    : modoTafNaval
                      ? 'TAF NAVAL'
                      : 'PROVA AO VIVO'
                }
                title={modoPreCadastro ? 'Selecione a atividade' : modoTafNaval ? 'Provas dos Fuzileiros Navais' : 'Selecione a prova'}
                subtitle={
                  modoPreCadastro
                    ? modoTafNaval
                      ? `Provas CFN — até ${MAX_PRE_CADASTRO_PARTICIPANTES} participantes por atividade.`
                      : `Armada: corrida, natação e permanência (até ${MAX_PRE_CADASTRO_PARTICIPANTES}). Caminhada: até ${MAX_PARTICIPANTES}.`
                    : modoTafNaval
                      ? 'Corrida 3200 m, natação 100 m, flexões, abdominais e permanência — CGCFN-108 § 5.5.2'
                      : 'Toque na modalidade para configurar participantes e iniciar'
                }
              />
              <AplicarTafProvaSelector
                variant={modoTafNaval ? 'naval' : 'padrao'}
                onSelect={handleProvaSelect}
              />
            </View>
          </AplicarTafGlassPanel>
        ) : null}

        {mostrarProvas && corridaEtapa === 'participantes' ? (
          <AplicarTafGlassPanel accent="cyan">
            <View style={styles.section}>
              <AplicarTafBackLink label="Voltar para seleção de provas" onPress={voltarMenuProvas} />
              <AplicarTafSectionHeader
                kicker="EQUIPE"
                title="Número de participantes"
                subtitle={
                  modoPreCadastro
                    ? tipoProva === 'caminhada'
                      ? `Informe de 1 a ${MAX_PARTICIPANTES} participantes.`
                      : `Informe de 1 a ${MAX_PRE_CADASTRO_PARTICIPANTES} participantes.`
                    : `Quantos militares participarão da ${tituloProvaCurta.toLowerCase()}?`
                }
              />
              <AplicarTafInput
                value={numeroParticipantesCorrida}
                onChangeText={onChangeParticipantes}
                placeholder="0"
                keyboardType="number-pad"
                maxLength={5}
                autoCorrect={false}
                spellCheck={false}
                accessibilityLabel={`Número de participantes da ${tituloProvaCurta.toLowerCase()}`}
              />
              {erroParticipantes ? <Text style={styles.erroText}>{erroParticipantes}</Text> : null}
              <AplicarTafPrimaryButton label="Confirmar" onPress={confirmarParticipantes} />
            </View>
          </AplicarTafGlassPanel>
        ) : null}

        {mostrarProvas && corridaEtapa === 'nips' ? (
          <AplicarTafGlassPanel accent="violet">
            <View style={styles.section}>
              <AplicarTafBackLink label="Voltar para número de participantes" onPress={voltarParticipantes} />
              <AplicarTafSectionHeader
                kicker="IDENTIFICAÇÃO"
                title={`${tituloProvaCurta} — NIPs`}
                subtitle={
                  demoAtivo
                    ? `Preencha o NIP de cada um dos ${nParticipantesConfirmado} participantes ou toque no ícone ✨ acima para preencher automaticamente.`
                    : `Preencha o NIP de cada um dos ${nParticipantesConfirmado} participantes.`
                }
              />

            {nipsParticipantes.map((nip, index) => {
              const fb = nipFeedbackLinhas[index];
              return (
              <View
                key={index}
                style={[
                  styles.nipGlassPanel,
                  { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(2,6,23,0.35)' : 'rgba(255,255,255,0.5)' },
                ]}
              >
                <View style={styles.nipFieldBlock}>
                  <LabelNip color={ui.label} fontSize={11} fontWeight="800" />
                  <View style={styles.nipInputRow}>
                    <AplicarTafInput
                      value={nip}
                      onChangeText={(t) => atualizarNip(index, t)}
                      placeholder="00.0000.00"
                      keyboardType="number-pad"
                      style={styles.inputNipFlex}
                      autoCorrect={false}
                      spellCheck={false}
                      accessibilityLabel={`NIP do participante ${index + 1}`}
                    />
                    <TouchableOpacity
                      accessibilityLabel={`Confirmar NIP do participante ${index + 1}`}
                      activeOpacity={0.9}
                      onPress={() => verificarNipNoCadastro(index)}
                      style={styles.nipOkBtnWrap}
                    >
                      <LinearGradient
                        colors={[theme.primary, '#6366f1']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.nipOkBtn}
                      >
                        <Text style={[styles.nipOkBtnText, { color: theme.tokens.textOnPrimary }]}>OK</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>

                {fb?.tipo === 'ok' ? (
                  <View
                    style={[
                      styles.militarIdentityCard,
                      {
                        borderColor: theme.isDark ? 'rgba(34,197,94,0.35)' : 'rgba(22,163,74,0.22)',
                        backgroundColor: theme.isDark ? 'rgba(34,197,94,0.08)' : 'rgba(220,252,231,0.45)',
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={
                        theme.isDark
                          ? ['rgba(34,197,94,0.35)', 'rgba(56,189,248,0.2)']
                          : ['rgba(34,197,94,0.55)', 'rgba(37,99,235,0.35)']
                      }
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.militarIdentityStripe}
                    />
                    <View style={styles.militarIdentityRow}>
                      <View
                        style={[
                          styles.militarNumOrb,
                          { backgroundColor: theme.isDark ? 'rgba(34,197,94,0.22)' : PREMIUM.accentMuted },
                        ]}
                      >
                        <Text style={[styles.militarNumOrbText, { color: theme.success }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.militarNomeCol}>
                        <Text style={[styles.militarRoleLabel, { color: theme.textSecondary }]}>
                          {labelAtleta}
                        </Text>
                        <Text style={[styles.militarNomeText, { color: ui.text }]} numberOfLines={2}>
                          {fb.nomeMilitar}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.militarHashBadge,
                          { backgroundColor: theme.isDark ? 'rgba(56,189,248,0.15)' : 'rgba(37,99,235,0.1)' },
                        ]}
                      >
                        <Text style={[styles.militarHashText, { color: theme.primary }]}>#{index + 1}</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
                {fb?.tipo === 'completar_dados' ? (
                  <View
                    style={[
                      styles.dadosNipBox,
                      { backgroundColor: inputBg, borderColor: inputBorder },
                    ]}
                  >
                    <Text style={[ts.bodySecondary, styles.dadosNipLead]}>
                      {fb.nomeMilitar}: informe data de nascimento e gênero. Os dados serão salvos no
                      cadastro.
                    </Text>
                    <Text style={[ts.label, styles.dadosNipFieldLabel]}>Data de nascimento</Text>
                    <AplicarTafInput
                      value={fb.dataNascimento}
                      onChangeText={(t) =>
                        atualizarDadosNipLinha(index, { dataNascimento: formatDateInput(t) })
                      }
                      placeholder="DD/MM/AAAA"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                      inputMode="numeric"
                      maxLength={10}
                      accessibilityLabel={`Data de nascimento do participante ${index + 1}`}
                    />
                    <Text style={[ts.label, styles.dadosNipFieldLabel]}>Gênero</Text>
                    <View style={[styles.dadosNipSegmented, { borderColor: theme.border }]}>
                      {(['M', 'F'] as const).map((sx) => {
                        const active = fb.sexo === sx;
                        return (
                          <TouchableOpacity
                            key={sx}
                            accessibilityLabel={sx === 'M' ? 'Masculino' : 'Feminino'}
                            onPress={() => atualizarDadosNipLinha(index, { sexo: sx })}
                            style={[
                              styles.dadosNipSegmentBtn,
                              {
                                backgroundColor: active ? selectedBgColor : theme.backgroundSecondary,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                ts.caption,
                                { color: active ? selectedTextColor : theme.textSecondary },
                                styles.dadosNipSegmentText,
                              ]}
                            >
                              {sx === 'M' ? 'Masculino' : 'Feminino'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {fb.erro ? <Text style={styles.feedbackErro}>{fb.erro}</Text> : null}
                    <AplicarTafPrimaryButton
                      label="Salvar e confirmar"
                      onPress={() => void confirmarDadosNipLinha(index)}
                    />
                  </View>
                ) : fb ? (
                  <Text style={fb.tipo === 'ok' ? styles.feedbackOk : styles.feedbackErro}>
                    {fb.tipo === 'ok' || fb.tipo === 'erro' ? fb.texto : ''}
                  </Text>
                ) : null}
              </View>
            );
            })}

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

      <TafProvaTempoModal
        visible={
          mostrarProvas &&
          modalProvaTempoVisible &&
          !modalRubricaNatacaoVisible &&
          !modalTempoRegistradoVisible &&
          !fluxoAplicadorVisible
        }
        onClose={voltarDeTabelaParaNips}
        prova={provaModalTipo}
        tituloProva={tituloProvaCurta}
        labelAtleta={labelAtleta}
        tempoExibido={tempoExibido}
        cronometroEstado={cronometroEstado}
        cronometroPausadoTexto={cronometroPausadoTexto}
        onCronometroPausadoTextoChange={onCronometroPausadoTextoChange}
        onBlurCronometroPausado={onBlurCronometroPausado}
        onIniciarCronometro={iniciarCronometroCorrida}
        onPararCronometro={pararCronometroCorrida}
        onPausarCronometro={pausarCronometroCorrida}
        onContinuarCronometro={continuarCronometroCorrida}
        cronometroHint={
          corridaEtapa === 'tabela_permanencia' ? 'Limite da prova: 10:00' : undefined
        }
        numeroVoltas={numeroVoltas}
        onChangeNumeroVoltas={onChangeNumeroVoltas}
        nColunasVoltas={nColunasVoltas}
        nParticipantes={nParticipantesConfirmado}
        nomesParticipantes={nomesParticipantesModal}
        checksVoltas={checksVoltas}
        chegadaNatacao={chegadaNatacao}
        onToggleVolta={toggleCheckVolta}
        onToggleChegada={toggleMarcarChegadaNatacao}
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
        visible={mostrarProvas && modalProvaRepeticoesVisible}
        onClose={voltarDeTabelaParaNips}
        tituloProva={tituloProvaCurta}
        nParticipantes={nParticipantesConfirmado}
        nomesParticipantes={nomesParticipantesModal}
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

function createAplicarTafStyles(theme: AppTheme, ui: ReturnType<typeof getUiColors>) {
  return StyleSheet.create({
  safe: { flex: 1, position: 'relative' as const },
  keyboardRoot: { flex: 1 },
  scrollContentCadastro: { paddingVertical: 12 },
  centerWrap: { flex: 1, alignItems: 'stretch' as const, maxWidth: 720, alignSelf: 'center', width: '100%' },
  section: { width: '100%' },
  preCadastroVazio: {
    marginBottom: 16,
    textAlign: 'center',
  },
  preCadastroActions: {
    gap: 12,
    marginTop: 4,
  },
  modalTempoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(12px)' } as object) : null),
  },
  modalFuturisticCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: PREMIUM.radiusLg + 4,
    backgroundColor: theme.isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
    padding: 22,
    borderWidth: 1,
    borderColor: theme.isDark ? 'rgba(148, 163, 184, 0.22)' : theme.border,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 24px 64px rgba(15,23,42,0.28)' } as object)
      : {
          shadowColor: '#0f172a',
          shadowOffset: { width: 0, height: 16 },
          shadowOpacity: 0.25,
          shadowRadius: 28,
          elevation: 12,
        }),
  },
  modalFuturisticStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  modalTempoMensagemCadastro: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    color: ui.text,
    lineHeight: 24,
    marginTop: 6,
  },
  modalTempoParcialCadastro: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: ui.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  btnIniciarDisabled: {
    opacity: 0.72,
  },
  nipGlassPanel: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd + 2,
    padding: 12,
    marginBottom: 10,
    gap: 10,
  },
  nipFieldBlock: {
    gap: 6,
  },
  nipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nipOkBtnWrap: {
    width: 56,
    height: 48,
    borderRadius: PREMIUM.radiusMd + 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  nipOkBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nipOkBtnText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  inputNipFlex: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
    paddingVertical: 12,
  },
  militarIdentityCard: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  militarIdentityStripe: {
    height: 2,
    width: '100%',
  },
  militarIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  militarNumOrb: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  militarNumOrbText: {
    fontSize: 16,
    fontWeight: '900',
  },
  militarNomeCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  militarRoleLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  militarNomeText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  militarHashBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    flexShrink: 0,
  },
  militarHashText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  feedbackOk: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.isDark ? ui.text : theme.success,
  },
  feedbackErro: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.isDark ? ui.text : '#B91C1C',
  },
  dadosNipBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    gap: 8,
  },
  dadosNipLead: {
    lineHeight: 18,
  },
  dadosNipFieldLabel: {
    marginTop: 4,
    marginBottom: 0,
  },
  dadosNipSegmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    overflow: 'hidden',
  },
  dadosNipSegmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dadosNipSegmentText: {
    fontWeight: '700',
  },
  btnSalvarDadosNip: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
  },
  erroText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: theme.isDark ? ui.text : '#B91C1C',
  },
  campoVoltasInput: {
    width: '100%',
    marginBottom: 16,
  },
  tabelaScrollHorizontal: {
    width: '100%',
    marginBottom: 4,
  },
  tabelaCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tabelaHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: ui.headerBorder,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: ui.tableHeaderBg,
  },
  tabelaHeaderCell: {
    fontSize: 12,
    fontWeight: '900',
    color: ui.text,
  },
  tabelaHeaderVolta: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  tabelaDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    minHeight: 44,
  },
  tabelaCell: {
    justifyContent: 'center',
  },
  tabelaCellText: {
    fontSize: 12,
    fontWeight: '700',
    color: ui.text,
  },
  tabelaColCorredor: {
    width: 56,
    minWidth: 56,
    paddingRight: 4,
  },
  tabelaColNome: {
    flex: 1,
    minWidth: 100,
    paddingRight: 4,
  },
  tabelaGrupoNomeVoltas: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  tabelaColNomeInline: {
    width: 128,
    minWidth: 96,
    maxWidth: 160,
    paddingRight: 4,
  },
  tabelaColChegadaInline: {
    width: 40,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  tabelaHeaderChegada: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: -0.2,
    textAlign: 'center',
    width: 52,
    minWidth: 52,
  },
  tabelaColMarcarChegada: {
    width: 128,
    minWidth: 128,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tabelaColVolta: {
    width: 40,
    minWidth: 40,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  tabelaColTempo: {
    width: 82,
    minWidth: 82,
    textAlign: 'center',
  },
  tabelaColNota: {
    width: 64,
    minWidth: 64,
    textAlign: 'center',
  },
  tabelaNotaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tabelaNotaRepro: {
    color: theme.isDark ? ui.text : '#B91C1C',
    fontSize: 9,
  },
  tabelaCelulaTempo: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabelaTempoText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  tabelaCelulaCheck: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkVoltaOuter: {
    padding: 2,
  },
  checkVoltaBox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkVoltaBoxOff: {
    borderColor: theme.isDark ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.25)',
    backgroundColor: 'transparent',
  },
  checkVoltaBoxOn: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  tabelaNumeroVerde: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.isDark ? ui.text : theme.success,
  },
  modalPermanenciaFinalTitulo: {
    fontSize: 18,
    fontWeight: '900',
    color: ui.text,
    textAlign: 'center',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  modalPermanenciaFinalSub: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
  },
  });
}
