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
  Modal,
  SafeAreaView,
  GestureResponderEvent,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { getUiColors } from '../theme/uiColors';
import type { AppTheme } from '../theme/premium';
import { PREMIUM } from '../theme/premium';
import { Card } from '../components/Card';
import { LandscapeOrientationModal } from '../components/sismav/LandscapeOrientationModal';
import {
  ModalTesteJaAplicado,
  type ModalTesteJaAplicadoInfo,
} from '../components/sismav/ModalTesteJaAplicado';
import {
  PermanenciaTafPanel,
  type ResultadoPermanenciaOpcao,
} from '../components/PermanenciaTafPanel';
import { LabelNip } from '../components/LabelNip';
import { getAllCadastros, addCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addSessaoAplicacao, getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { persistirRubricasNoCadastro } from '../utils/persistirRubricaCadastro';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import {
  buscarRegistroModalidadeExistente,
  removerParticipanteModalidadeDoHistorico,
} from '../utils/registroModalidadeHistorico';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { dataHojeBr } from '../utils/tafRegistro';
import { formatMsByModality, parseTafPerformanceInput, type TafModality } from '../taf/tafTimeFormat';
import {
  notaCorridaParaPersistencia,
  textoNotaCorridaFromCadastro,
} from '../taf/corrida2400Nota';
import {
  notaNatacaoParaPersistencia,
  textoNotaNatacaoFromCadastro,
} from '../taf/natacaoNota';
import { useTafTimeFormat } from '../hooks/useTafTimeFormat';
import type { RootStackParamList, ResultadoCorridaItem } from '../navigation/AppNavigator';
import { Check, ChevronLeft, Pause, Play } from 'lucide-react-native';
import {
  aplicarTafTrialReducer,
  initialTrialTableState,
} from './aplicarTafTrialReducer';

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

const MAX_PARTICIPANTES = 200;

/** Duração da prova de permanência — ao atingir, exibe modal de finalização. */
const PERMANENCIA_DURACAO_MS = 10 * 60 * 1000;

type CorridaEtapa = 'menu' | 'participantes' | 'nips' | 'tabela_corrida' | 'tabela_permanencia';

type TipoProvaTAF = 'corrida' | 'natacao' | 'permanencia';

/** Cronômetro da corrida: pode pausar e retomar antes de parar de vez. */
type CronometroCorridaEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

type NipFeedbackLinha =
  | { tipo: 'ok'; texto: string; nomeMilitar: string; dataNascimento: string; sexo?: 'M' | 'F' }
  | { tipo: 'erro'; texto: string }
  | null;

const MAX_VOLTAS_COLUNAS = 99;
const RUBRICA_CANVAS_HEIGHT = 180;

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const grayBg = theme.background;
  const selectedBgColor = theme.primary;
  const selectedTextColor = theme.text;
  const inputBg = theme.cardBg;
  const inputBorder = ui.inputBorder;
  const inputTextColor = ui.text;
  const [modalOrientacaoPaisagem, setModalOrientacaoPaisagem] = useState(false);
  const [mostrarProvas, setMostrarProvas] = useState(false);
  const [tipoProva, setTipoProva] = useState<TipoProvaTAF | null>(null);
  const tipoProvaRef = useRef<TipoProvaTAF | null>(null);
  /** Antes do paint, para o cronômetro nunca formatar corrida (MM:SS) durante natação. */
  useLayoutEffect(() => {
    tipoProvaRef.current = tipoProva;
  }, [tipoProva]);
  const modalityTime: TafModality = tipoProva === 'natacao' ? 'natacao' : 'corrida';
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
  const [modalTesteExistente, setModalTesteExistente] = useState<
    (ModalTesteJaAplicadoInfo & { dataNascimento: string; sexo?: 'M' | 'F' }) | null
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
  /** Lista espelhada em estado para o modal de rúbrica re-renderizar ao mudar o participante. */
  const [listaResultadosRubricaNatacao, setListaResultadosRubricaNatacao] = useState<
    ResultadoCorridaItem[] | null
  >(null);
  const [modalRubricaNatacaoVisible, setModalRubricaNatacaoVisible] = useState(false);
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
    tipoProva === 'natacao' ? true : mostrarColunaTempoCorrida;

  /** Nota corrida: exige coluna de tempo visível. */
  const mostrarColunaNotaCorrida = tipoProva === 'corrida' && mostrarColunaTempo;

  /**
   * Natação: coluna “Nota” sempre ao lado de “Tempo” (valores preenchidos após marcar chegada;
   * tabelas F/M — `textoNotaNatacao`).
   */
  const mostrarColunaNotaNatacao = tipoProva === 'natacao';

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
      const tempoStr = formatMsByModality('corrida', ms);
      out.push(
        textoNotaCorridaFromCadastro({
          tempoCorrida: tempoStr,
          dataNascimento: fb.dataNascimento,
          sexo: fb.sexo,
        }),
      );
    }
    return out;
  }, [
    mostrarColunaNotaCorrida,
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
      const tempoStr = formatMsByModality('natacao', ms);
      out.push(
        textoNotaNatacaoFromCadastro({
          tempoNatacao: tempoStr,
          dataNascimento: fb.dataNascimento,
          sexo: fb.sexo,
        }),
      );
    }
    return out;
  }, [
    tipoProva,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
    chegadaNatacao,
  ]);

  const larguraMinTabela = useMemo(() => {
    const wVolta = 44;
    const wNome = 200;
    const wTempo = 82;
    const wNota = 64;
    const wAtleta = 72;
    if (tipoProva === 'natacao') {
      const wMarcar = 128;
      let w = wAtleta + wNome + wMarcar + 24;
      if (mostrarColunaTempo) w += wTempo;
      if (mostrarColunaNotaNatacao) w += wNota;
      return w;
    }
    let w = wAtleta + wNome + nColunasVoltas * wVolta + 24;
    if (mostrarColunaTempo) w += wTempo;
    if (mostrarColunaNotaCorrida) w += wNota;
    return w;
  }, [
    tipoProva,
    nColunasVoltas,
    mostrarColunaTempo,
    mostrarColunaNotaCorrida,
    mostrarColunaNotaNatacao,
  ]);

  /** Todos com tempo registrado (corrida: última volta; natação: chegada). */
  const todosIntegrantesComTempoRegistrado = useMemo(() => {
    const p = nParticipantesConfirmado;
    if (p < 1) return false;
    if (tipoProva === 'natacao') {
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
    if (corridaEtapa !== 'tabela_corrida' || tipoProva !== 'corrida') return;
    dispatchTrial({
      type: 'resizeChecksGrid',
      p: nParticipantesConfirmado,
      v: nColunasVoltas,
    });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado, nColunasVoltas]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida' || tipoProva !== 'natacao') return;
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

  const gravarSessaoAplicacao = useCallback(
    async (resultados: ResultadoCorridaItem[]) => {
      const tipo = tipoProvaRef.current ?? tipoProva;
      if (!tipo || resultados.length === 0) return;

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

      await addSessaoAplicacao({
        dataAplicacao: dataHojeBr(),
        tipoProva: tipo,
        resultados,
      });
    },
    [tipoProva, nipsParticipantes],
  );

  const onCadastrarResultados = useCallback(async () => {
    if (salvandoResultadosCorrida) return;
    if (tipoProva !== 'corrida' && tipoProva !== 'natacao') {
      Alert.alert(
        'Tipo de prova não definido',
        'Volte ao menu e inicie o TAF escolhendo Corrida ou Natação.',
      );
      return;
    }
    const prova = tipoProva;
    const labelAtleta = prova === 'natacao' ? 'Nadador' : 'Corredor';

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
          ? (fb.nomeMilitar || '').trim() || `${labelAtleta} ${i + 1}`
          : `${labelAtleta} ${i + 1}`;
      const nip = nipsParticipantes[i] ?? '';
      const tempoMs = temposMilitaresMs[i] ?? 0;
      let notaTexto: string | undefined;
      if (prova === 'corrida') {
        const fbOk = nipFeedbackLinhas[i];
        if (fbOk?.tipo === 'ok' && temposMilitaresMs[i] != null) {
          const tempoStr = formatMsByModality('corrida', temposMilitaresMs[i]!);
          notaTexto = notaCorridaParaPersistencia(
            textoNotaCorridaFromCadastro({
              tempoCorrida: tempoStr,
              dataNascimento: fbOk.dataNascimento,
              sexo: fbOk.sexo,
            }),
          );
        }
      } else if (prova === 'natacao') {
        const fbOk = nipFeedbackLinhas[i];
        if (fbOk?.tipo === 'ok' && temposMilitaresMs[i] != null) {
          const tempoStr = formatMsByModality('natacao', temposMilitaresMs[i]!);
          notaTexto = notaNatacaoParaPersistencia(
            textoNotaNatacaoFromCadastro({
              tempoNatacao: tempoStr,
              dataNascimento: fbOk.dataNascimento,
              sexo: fbOk.sexo,
            }),
          );
        }
      }

      resultados.push({
        corredor: i + 1,
        nome: nomeBase,
        tempoMs,
        nip,
        prova,
        notaTexto,
        noraTexto: notaTexto,
        reprovacaoTexto: notaTexto === 'REPROVADO' ? 'Reprovado' : undefined,
      });
    }

    setSalvandoResultadosCorrida(true);
    try {
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
        const tempoStr = formatMsByModality(prova, r.tempoMs);
        const hoje = dataHojeBr();
        const atualizado: CadastroItemPersist =
          prova === 'natacao'
            ? {
                ...busca.cadastro,
                tempoNatacao: tempoStr,
                dataTafNatacao: hoje,
                notaNatacao: notaNatacaoParaPersistencia(
                  textoNotaNatacaoFromCadastro({
                    tempoNatacao: tempoStr,
                    dataNascimento: busca.cadastro.dataNascimento,
                    sexo: busca.cadastro.sexo,
                  }),
                ),
              }
            : {
                ...busca.cadastro,
                tempoCorrida: tempoStr,
                dataTafCorrida: hoje,
                notaCorrida: notaCorridaParaPersistencia(
                  textoNotaCorridaFromCadastro({
                    tempoCorrida: tempoStr,
                    dataNascimento: busca.cadastro.dataNascimento,
                    sexo: busca.cadastro.sexo,
                  }),
                ),
              };
        await addCadastro(atualizado);
        const idx = listaAtual.findIndex((c) => c.id === busca.cadastro.id);
        if (idx >= 0) listaAtual[idx] = atualizado;
        ok += 1;
      }

      pendingResultadosNavRef.current = resultados;

      if (ok > 0) {
        const avisoParcial =
          naoEncontrados.length > 0
            ? `Registro parcial: não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`
            : null;
        if ((prova === 'natacao' || prova === 'corrida') && resultados.length > 0) {
          setModalParcialAviso(avisoParcial);
          setRubricasNatacaoSvg(Array.from({ length: resultados.length }, () => ''));
          setIndiceRubricaNatacao(0);
          setErroRubricaNatacao('');
          setRubricaStrokes([]);
          setRubricaStrokeAtual([]);
          const copiaResultados = resultados.map((r) => ({ ...r }));
          setListaResultadosRubricaNatacao(copiaResultados);
          pendingResultadosNavRef.current = copiaResultados;
          setModalRubricaNatacaoVisible(true);
        } else {
          setModalParcialAviso(avisoParcial);
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
                void gravarSessaoAplicacao(resultados).then(() => {
                  navigation.navigate('CadastrarResultados', { resultados });
                });
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
              void gravarSessaoAplicacao(resultados).then(() => {
                navigation.navigate('CadastrarResultados', { resultados });
              });
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
  ]);

  const fecharModalTempoRegistrado = useCallback(() => {
    setModalTempoRegistradoVisible(false);
    setModalParcialAviso(null);
    const res = pendingResultadosNavRef.current;
    pendingResultadosNavRef.current = null;
    if (res) {
      void gravarSessaoAplicacao(res).then(() => {
        navigation.navigate('CadastrarResultados', { resultados: res });
      });
    }
  }, [navigation, gravarSessaoAplicacao]);

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
      RUBRICA_CANVAS_HEIGHT,
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
    void gravarSessaoAplicacao(atualizados).then(async () => {
      await persistirRubricasNoCadastro(atualizados);
      navigation.navigate('CadastrarResultados', { resultados: atualizados });
    });
    pendingResultadosNavRef.current = null;
    setModalParcialAviso(null);
  }, [
    indiceRubricaNatacao,
    listaResultadosRubricaNatacao,
    modalParcialAviso,
    navigation,
    gravarSessaoAplicacao,
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
    if (!Number.isFinite(n) || n < 1) {
      setErroParticipantes('Informe um número válido (mínimo 1).');
      return;
    }
    if (n > MAX_PARTICIPANTES) {
      setErroParticipantes(`Máximo de ${MAX_PARTICIPANTES} participantes.`);
      return;
    }
    setErroParticipantes('');
    setNParticipantesConfirmado(n);
    setNipsParticipantes(Array.from({ length: n }, () => ''));
    setNipFeedbackLinhas(Array.from({ length: n }, () => null));
    setCorridaEtapa('nips');
  }, [numeroParticipantesCorrida]);

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
    const nome = (c.nome || '').trim() || 'Sem nome';
    const modalidade = tipoProvaRef.current ?? tipoProva;

    if (
      modalidade &&
      !nipsRepeticaoAutorizadaRef.current.has(index)
    ) {
      const sessoes = await getAllSessoesAplicacao();
      const existente = buscarRegistroModalidadeExistente(nip, modalidade, sessoes, c);
      if (existente) {
        setModalTesteExistente({
          index,
          nip,
          nome,
          registro: existente,
          dataNascimento: c.dataNascimento || '',
          sexo: c.sexo,
        });
        return;
      }
    }

    definirNipOk(index, c);
  }, [nipsParticipantes, tipoProva, definirNipOk]);

  const fecharModalTesteExistente = useCallback(() => {
    setModalTesteExistente(null);
  }, []);

  const confirmarRepeticaoTeste = useCallback(() => {
    if (!modalTesteExistente) return;
    const { index, dataNascimento, sexo, nip, nome } = modalTesteExistente;
    nipsRepeticaoAutorizadaRef.current.add(index);
    definirNipOk(index, {
      id: '',
      nip,
      nome,
      dataNascimento,
      sexo,
    });
    setModalTesteExistente(null);
  }, [modalTesteExistente, definirNipOk]);

  const prepararProva = useCallback(() => {
    if (tipoProva !== 'corrida' && tipoProva !== 'natacao') {
      Alert.alert(
        'Tipo de prova não definido',
        'Volte ao menu e escolha Corrida ou Natação antes de continuar.',
      );
      return;
    }
    resetCronometroCorrida();
    dispatchTrial({
      type: 'prepararProva',
      nParticipantes: nParticipantesConfirmado,
      tipoProva: tipoProva === 'natacao' ? 'natacao' : 'corrida',
    });
    setCorridaEtapa('tabela_corrida');
  }, [resetCronometroCorrida, nParticipantesConfirmado, tipoProva]);

  const prepararPermanencia = useCallback(() => {
    for (let i = 0; i < nParticipantesConfirmado; i += 1) {
      if (nipFeedbackLinhas[i]?.tipo !== 'ok') {
        Alert.alert(
          'NIPs pendentes',
          'Confirme o NIP de todos os participantes (botão OK em cada linha).',
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
        await addCadastro(atualizado);
        const idx = listaAtual.findIndex((c) => c.id === busca.cadastro.id);
        if (idx >= 0) listaAtual[idx] = atualizado;
        ok += 1;
      }

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
    setCorridaEtapa('nips');
  }, [resetCronometroCorrida]);

  const iniciarTaf = useCallback(() => {
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
  }, [resetCronometroCorrida]);

  const confirmarOrientacaoEIniciarTaf = useCallback(() => {
    setModalOrientacaoPaisagem(false);
    iniciarTaf();
  }, [iniciarTaf]);

  const aoPressionarIniciarTaf = useCallback(() => {
    setModalOrientacaoPaisagem(true);
  }, []);

  const tituloProvaCurta =
    tipoProva === 'natacao'
      ? 'Natação'
      : tipoProva === 'permanencia'
        ? 'Permanência'
        : 'Corrida';
  const labelAtleta =
    tipoProva === 'natacao'
      ? 'Nadador'
      : tipoProva === 'permanencia'
        ? 'Militar'
        : 'Corredor';

  const participantesPermanencia = useMemo(
    () =>
      Array.from({ length: nParticipantesConfirmado }, (_, index) => {
        const fb = nipFeedbackLinhas[index];
        return {
          index,
          nome: fb?.tipo === 'ok' ? fb.nomeMilitar : `Participante ${index + 1}`,
        };
      }),
    [nParticipantesConfirmado, nipFeedbackLinhas],
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: grayBg }]}>
      <LandscapeOrientationModal
        visible={modalOrientacaoPaisagem}
        onContinue={confirmarOrientacaoEIniciarTaf}
        onClose={() => setModalOrientacaoPaisagem(false)}
      />

      <ModalTesteJaAplicado
        info={modalTesteExistente}
        onClose={fecharModalTesteExistente}
        onConfirmarRepeticao={confirmarRepeticaoTeste}
      />

      <Modal
        visible={modalPermanenciaFinalizadaVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalPermanenciaFinalizadaVisible(false)}
        accessibilityViewIsModal
      >
        <View style={styles.modalTempoOverlay}>
          <View style={styles.modalPermanenciaFinalCard}>
            <Text style={styles.modalPermanenciaFinalTitulo}>PERMANÊNCIA FINALIZADA</Text>
            <Text style={styles.modalPermanenciaFinalSub}>
              O tempo de 10 minutos foi atingido. Continue marcando Aprovado ou Reprovado e
              aplique o resultado quando terminar.
            </Text>
            <TouchableOpacity
              accessibilityLabel="Fechar aviso de permanência finalizada"
              activeOpacity={0.85}
              onPress={() => setModalPermanenciaFinalizadaVisible(false)}
              style={styles.modalTempoBtnPrimaryCadastro}
            >
              <Text style={styles.modalTempoBtnPrimaryTextCadastro}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalTempoRegistradoVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharModalTempoRegistrado}
        accessibilityViewIsModal
      >
        <View style={styles.modalTempoOverlay}>
          <View style={styles.modalTempoCardCadastro}>
            <Text style={styles.modalTempoMensagemCadastro}>
              Tempo Registrado com Sucesso verifique tabela de Registrador de TAF
            </Text>
            {modalParcialAviso ? (
              <Text style={styles.modalTempoParcialCadastro}>{modalParcialAviso}</Text>
            ) : null}
            <TouchableOpacity
              accessibilityLabel="Fechar aviso e ver resumo"
              activeOpacity={0.85}
              onPress={fecharModalTempoRegistrado}
              style={styles.modalTempoBtnPrimaryCadastro}
            >
              <Text style={styles.modalTempoBtnPrimaryTextCadastro}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={modalRubricaNatacaoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
        accessibilityViewIsModal
      >
        <View style={styles.modalTempoOverlay}>
          <View style={styles.modalRubricaCardCadastro}>
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
                    : 'Corrida';
              return (
                <View key={`rubrica-participante-${indiceRubricaNatacao}`}>
                  <Text style={styles.modalRubricaSubtituloCadastro}>
                    Participante {indiceRubricaNatacao + 1} de {totalLista}
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    Modalidade:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>{tituloModalidade}</Text>
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    Nome:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>{participanteAtual.nome}</Text>
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    NIP:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>
                      {participanteAtual.nip || '—'}
                    </Text>
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    Tempo de prova:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>
                      {formatMsByModality(modProva, participanteAtual.tempoMs)}
                    </Text>
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    NOTA:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>
                      {textoNotaRubricaModal(participanteAtual)}
                    </Text>
                  </Text>
                  <Text style={styles.modalRubricaLinhaCadastro}>
                    Situação:{' '}
                    <Text style={styles.modalRubricaLinhaStrong}>
                      {textoSituacaoRubricaModal(participanteAtual)}
                    </Text>
                  </Text>
                  <Text style={styles.modalRubricaLegendaCadastro}>Rúbrica do candidato</Text>
                  <View
                    style={styles.modalRubricaCanvasWrap}
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
                  </View>
                  <TouchableOpacity
                    accessibilityLabel="Limpar rúbrica"
                    activeOpacity={0.85}
                    onPress={limparRubricaNatacaoAtual}
                    style={styles.modalRubricaBtnSecundario}
                  >
                    <Text style={styles.modalRubricaBtnSecundarioText}>Limpar assinatura</Text>
                  </TouchableOpacity>
                  {erroRubricaNatacao ? (
                    <Text style={styles.modalRubricaErroCadastro}>{erroRubricaNatacao}</Text>
                  ) : null}
                  <TouchableOpacity
                    accessibilityLabel="Confirmar rúbrica do candidato"
                    activeOpacity={0.85}
                    onPress={confirmarRubricaNatacao}
                    style={styles.modalTempoBtnPrimaryCadastro}
                  >
                    <Text style={styles.modalTempoBtnPrimaryTextCadastro}>
                      {indiceRubricaNatacao + 1 < totalLista ? 'Próximo' : 'Finalizar'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContentCadastro}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrap}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              accessibilityLabel="Voltar"
            >
              <ChevronLeft size={26} color={theme.text} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={[ts.h2, styles.pageTitle]}>Aplicar TAF</Text>
            </View>
          </View>

          {!mostrarProvas ? (
            <View style={[styles.toggleStack, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <TouchableOpacity
                accessibilityLabel="Iniciar TAF"
                onPress={aoPressionarIniciarTaf}
                style={[
                  styles.toggleBtn,
                  { backgroundColor: selectedBgColor, borderColor: selectedBgColor },
                ]}
              >
                <Text style={[ts.caption, { color: selectedTextColor }, styles.toggleBtnText]}>
                  Iniciar TAF
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

        {mostrarProvas && corridaEtapa === 'menu' ? (
          <Card elevated style={styles.formCard}>
            <View style={styles.section}>
              <Text style={[ts.label, styles.labelText]}>Selecione a prova</Text>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  accessibilityLabel="Corrida"
                  onPress={abrirCorrida}
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                >
                  <Text style={[ts.body, styles.btnText]}>Corrida</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Natação"
                  onPress={abrirNatacao}
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                >
                  <Text style={[ts.body, styles.btnText]}>Natação</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel="Permanência"
                  onPress={abrirPermanencia}
                  style={[styles.btn, { backgroundColor: theme.primary }]}
                >
                  <Text style={[ts.body, styles.btnText]}>Permanência</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'participantes' ? (
          <Card elevated style={styles.formCard}>
            <View style={styles.section}>
              <TouchableOpacity
                accessibilityLabel="Voltar para seleção de provas"
                activeOpacity={0.85}
                onPress={voltarMenuProvas}
                style={styles.btnVoltarCadastro}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>← Voltar</Text>
              </TouchableOpacity>

              <Text style={[ts.label, styles.labelText]}>Número de Participantes</Text>
              <TextInput
                value={numeroParticipantesCorrida}
                onChangeText={onChangeParticipantes}
                placeholder="0"
                placeholderTextColor={ui.placeholder}
                keyboardType="number-pad"
                maxLength={5}
                style={[
                  styles.input,
                  { borderColor: inputBorder, backgroundColor: inputBg, color: inputTextColor },
                ]}
                autoCorrect={false}
                spellCheck={false}
                accessibilityLabel={`Número de participantes da ${tituloProvaCurta.toLowerCase()}`}
              />
              {erroParticipantes ? <Text style={styles.erroText}>{erroParticipantes}</Text> : null}

              <TouchableOpacity
                accessibilityLabel="Confirmar número de participantes"
                onPress={confirmarParticipantes}
                style={[styles.btn, { backgroundColor: theme.primary }]}
              >
                <Text style={[ts.body, styles.btnText]}>OK</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'nips' ? (
          <Card elevated style={styles.formCard}>
            <View style={styles.section}>
              <TouchableOpacity
                accessibilityLabel="Voltar para número de participantes"
                activeOpacity={0.85}
                onPress={voltarParticipantes}
                style={styles.btnVoltarCadastro}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>← Voltar</Text>
              </TouchableOpacity>

              <Text style={[ts.label, styles.labelText]}>
                {tituloProvaCurta} — NIPs dos participantes
              </Text>
              <Text style={[ts.bodySecondary, styles.formSubtitle]}>
                Preencha o NIP de cada um dos {nParticipantesConfirmado} participantes.
              </Text>

            {nipsParticipantes.map((nip, index) => (
              <View key={index} style={styles.nipRow}>
                <View style={styles.nipLabelRow}>
                  <LabelNip color={ui.label} fontSize={12} fontWeight="800" />
                </View>
                <View style={styles.nipInputRow}>
                  <TextInput
                    value={nip}
                    onChangeText={(t) => atualizarNip(index, t)}
                    placeholder="00.0000.00"
                    placeholderTextColor={ui.placeholder}
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      styles.inputNipFlex,
                      { borderColor: inputBorder, backgroundColor: inputBg, color: inputTextColor },
                    ]}
                    autoCorrect={false}
                    spellCheck={false}
                    accessibilityLabel={`NIP do participante ${index + 1}`}
                  />
                  <TouchableOpacity
                    accessibilityLabel={`Confirmar NIP do participante ${index + 1}`}
                    activeOpacity={0.85}
                    onPress={() => verificarNipNoCadastro(index)}
                    style={[styles.btnOkNip, { backgroundColor: theme.primary }]}
                  >
                    <Text style={[ts.body, styles.btnText]}>OK</Text>
                  </TouchableOpacity>
                  {nipFeedbackLinhas[index]?.tipo === 'ok' ? (
                    <View style={styles.nomeCorredorBeside}>
                      <Text style={styles.nomeCorredorBesideText} numberOfLines={4}>
                        ({nipFeedbackLinhas[index].nomeMilitar}) {labelAtleta} número{' '}
                        <Text style={styles.numeroCorredor}>{index + 1}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
                {nipFeedbackLinhas[index] ? (
                  <Text
                    style={
                      nipFeedbackLinhas[index]!.tipo === 'ok'
                        ? styles.feedbackOk
                        : styles.feedbackErro
                    }
                  >
                    {nipFeedbackLinhas[index]!.texto}
                  </Text>
                ) : null}
              </View>
            ))}

            <TouchableOpacity
              accessibilityLabel={`Preparar ${tituloProvaCurta}`}
              activeOpacity={0.85}
              onPress={tipoProva === 'permanencia' ? prepararPermanencia : prepararProva}
              style={[styles.btn, { backgroundColor: theme.primary }]}
            >
              <Text style={[ts.body, styles.btnText]}>Preparar {tituloProvaCurta}</Text>
            </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'tabela_permanencia' ? (
          <Card elevated style={styles.formCard}>
            <View style={styles.section}>
              <TouchableOpacity
                accessibilityLabel="Voltar para edição dos NIPs"
                activeOpacity={0.85}
                onPress={voltarDeTabelaParaNips}
                style={styles.btnVoltarCadastro}
              >
                <Text style={[ts.caption, { color: theme.textSecondary }]}>← Voltar</Text>
              </TouchableOpacity>
              <Text style={[ts.label, styles.labelText]}>Permanência preparada</Text>
              <PermanenciaTafPanel
                participantes={participantesPermanencia}
                resultados={resultadoPermanenciaLinhas}
                onToggleResultado={togglePermanenciaResultado}
                tempoExibido={tempoExibido}
                cronometroEstado={cronometroEstado}
                cronometroPausadoTexto={cronometroPausadoTexto}
                onCronometroPausadoTextoChange={onCronometroPausadoTextoChange}
                onBlurCronometroPausado={onBlurCronometroPausado}
                onIniciarCronometro={iniciarCronometroCorrida}
                onPararCronometro={pararCronometroCorrida}
                onPausarCronometro={pausarCronometroCorrida}
                onContinuarCronometro={continuarCronometroCorrida}
                onAplicarResultado={() => {
                  void onCadastrarPermanencia();
                }}
                salvando={salvandoResultadosCorrida}
                erroAplicar={erroPermanencia}
                inputBorder={inputBorder}
                inputBg={inputBg}
                inputTextColor={inputTextColor}
              />
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'tabela_corrida' ? (
          <Card elevated style={styles.formCard}>
            <View style={styles.section}>
            <TouchableOpacity
              accessibilityLabel="Voltar para edição dos NIPs"
              activeOpacity={0.85}
              onPress={voltarDeTabelaParaNips}
              style={styles.btnVoltarCadastro}
            >
              <Text style={[ts.caption, { color: theme.textSecondary }]}>← Voltar</Text>
            </TouchableOpacity>

            <Text style={[ts.label, styles.labelText]}>
              {tipoProva === 'natacao' ? 'Natação preparada' : 'Corrida preparada'}
            </Text>

            {tipoProva === 'corrida' ? (
              <>
                <Text style={[ts.label, styles.labelText]}>Número de Voltas</Text>
                <TextInput
                  value={numeroVoltas}
                  onChangeText={onChangeNumeroVoltas}
                  placeholder="0"
                  placeholderTextColor={ui.placeholder}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[
                    styles.input,
                    styles.campoVoltasInput,
                    { borderColor: inputBorder, backgroundColor: inputBg, color: inputTextColor },
                  ]}
                  autoCorrect={false}
                  spellCheck={false}
                  accessibilityLabel="Número de voltas da corrida"
                />
              </>
            ) : null}

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
              style={styles.tabelaScrollHorizontal}
            >
              <View
                style={[
                  styles.tabelaCard,
                  {
                    borderColor: inputBorder,
                    backgroundColor: inputBg,
                    minWidth: larguraMinTabela,
                  },
                ]}
              >
                <View style={styles.tabelaHeaderRow}>
                  <Text style={[styles.tabelaHeaderCell, styles.tabelaColCorredor]}>{labelAtleta}</Text>
                  <Text style={[styles.tabelaHeaderCell, styles.tabelaColNome]}>Nome</Text>
                  {tipoProva === 'natacao' ? (
                    <Text
                      style={[styles.tabelaHeaderCell, styles.tabelaColMarcarChegada]}
                      numberOfLines={2}
                    >
                      Marcar Chegada
                    </Text>
                  ) : nColunasVoltas > 0 ? (
                    Array.from({ length: nColunasVoltas }, (_, v) => (
                      <Text
                        key={`h-volta-${v}`}
                        style={[
                          styles.tabelaHeaderCell,
                          styles.tabelaHeaderVolta,
                          styles.tabelaColVolta,
                          v === 0 ? styles.tabelaColVoltaPrimeira : null,
                        ]}
                        numberOfLines={1}
                      >
                        V{v + 1}
                      </Text>
                    ))
                  ) : null}
                  {mostrarColunaTempo ? (
                    <Text style={[styles.tabelaHeaderCell, styles.tabelaColTempo]} numberOfLines={1}>
                      Tempo
                    </Text>
                  ) : null}
                  {mostrarColunaNotaCorrida ? (
                    <Text style={[styles.tabelaHeaderCell, styles.tabelaColNota]} numberOfLines={1}>
                      Nota
                    </Text>
                  ) : null}
                  {mostrarColunaNotaNatacao ? (
                    <Text style={[styles.tabelaHeaderCell, styles.tabelaColNota]} numberOfLines={1}>
                      Nota
                    </Text>
                  ) : null}
                </View>
                {Array.from({ length: nParticipantesConfirmado }, (_, index) => {
                  const fb = nipFeedbackLinhas[index];
                  const nome = fb?.tipo === 'ok' ? fb.nomeMilitar : '—';
                  const marcadoChegada = chegadaNatacao[index] ?? false;
                  return (
                    <View
                      key={index}
                      style={[
                        styles.tabelaDataRow,
                        index > 0 ? { borderTopWidth: 1, borderTopColor: ui.rowBorder } : null,
                      ]}
                    >
                      <View style={[styles.tabelaCell, styles.tabelaColCorredor]}>
                        <Text style={styles.tabelaNumeroVerde}>{index + 1}</Text>
                      </View>
                      <Text style={[styles.tabelaCellText, styles.tabelaColNome]} numberOfLines={2}>
                        {nome}
                      </Text>
                      {tipoProva === 'natacao' ? (
                        <View style={[styles.tabelaColMarcarChegada, styles.tabelaCelulaCheck]}>
                          <TouchableOpacity
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: marcadoChegada }}
                            accessibilityLabel={`Marcar chegada, ${labelAtleta} ${index + 1}`}
                            activeOpacity={0.85}
                            onPress={() => toggleMarcarChegadaNatacao(index)}
                            style={styles.checkVoltaOuter}
                          >
                            <View
                              style={[
                                styles.checkVoltaBox,
                                marcadoChegada ? styles.checkVoltaBoxOn : styles.checkVoltaBoxOff,
                              ]}
                            >
                              {marcadoChegada ? (
                                <Check size={11} color="#FFFFFF" strokeWidth={2.5} />
                              ) : null}
                            </View>
                          </TouchableOpacity>
                        </View>
                      ) : nColunasVoltas > 0 ? (
                        Array.from({ length: nColunasVoltas }, (__, v) => {
                          const marcado = checksVoltas[index]?.[v] ?? false;
                          return (
                            <View
                              key={`d-volta-${index}-${v}`}
                              style={[
                                styles.tabelaColVolta,
                                styles.tabelaCelulaCheck,
                                v === 0 ? styles.tabelaColVoltaPrimeira : null,
                              ]}
                            >
                              <TouchableOpacity
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: marcado }}
                                accessibilityLabel={`Volta ${v + 1}, participante ${index + 1}`}
                                activeOpacity={0.85}
                                onPress={() => toggleCheckVolta(index, v)}
                                style={styles.checkVoltaOuter}
                              >
                                <View
                                  style={[
                                    styles.checkVoltaBox,
                                    marcado ? styles.checkVoltaBoxOn : styles.checkVoltaBoxOff,
                                  ]}
                                >
                                  {marcado ? (
                                    <Check size={11} color="#FFFFFF" strokeWidth={2.5} />
                                  ) : null}
                                </View>
                              </TouchableOpacity>
                            </View>
                          );
                        })
                      ) : null}
                      {mostrarColunaTempo ? (
                        <View style={[styles.tabelaColTempo, styles.tabelaCelulaTempo]}>
                          <Text
                            style={[styles.tabelaCellText, styles.tabelaTempoText]}
                            numberOfLines={1}
                          >
                            {temposMilitaresMs[index] != null
                              ? formatMs(temposMilitaresMs[index]!)
                              : '—'}
                          </Text>
                        </View>
                      ) : null}
                      {mostrarColunaNotaCorrida ? (
                        <View style={[styles.tabelaColNota, styles.tabelaCelulaTempo]}>
                          <Text
                            style={[
                              styles.tabelaCellText,
                              styles.tabelaNotaText,
                              notaCorridaPorLinha[index] === 'REPROVADO' ? styles.tabelaNotaRepro : null,
                            ]}
                            numberOfLines={2}
                          >
                            {notaCorridaPorLinha[index] ?? '—'}
                          </Text>
                        </View>
                      ) : null}
                      {mostrarColunaNotaNatacao ? (
                        <View style={[styles.tabelaColNota, styles.tabelaCelulaTempo]}>
                          <Text
                            style={[
                              styles.tabelaCellText,
                              styles.tabelaNotaText,
                              notaNatacaoPorLinha[index] === 'REPROVADO' ? styles.tabelaNotaRepro : null,
                            ]}
                            numberOfLines={2}
                          >
                            {notaNatacaoPorLinha[index] ?? '—'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.cronometroBloco}>
              <View style={styles.iniciarCorridaRow}>
                {(cronometroEstado === 'inicial' || cronometroEstado === 'finalizado') ? (
                  <TouchableOpacity
                    accessibilityLabel={`Iniciar ${tituloProvaCurta}`}
                    activeOpacity={0.85}
                    onPress={iniciarCronometroCorrida}
                    style={styles.btnIniciarCorridaCadastro}
                  >
                    <Text style={styles.btnIniciarCorridaTextCadastro}>
                      Iniciar {tituloProvaCurta}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {(cronometroEstado === 'rodando' || cronometroEstado === 'pausado') ? (
                  <TouchableOpacity
                    accessibilityLabel={`Parar ${tituloProvaCurta}`}
                    activeOpacity={0.85}
                    onPress={pararCronometroCorrida}
                    style={styles.btnIniciarCorridaCadastro}
                  >
                    <Text style={styles.btnIniciarCorridaTextCadastro}>
                      Parar {tituloProvaCurta}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {cronometroEstado === 'rodando' ? (
                  <TouchableOpacity
                    accessibilityLabel="Pausar cronômetro"
                    activeOpacity={0.85}
                    onPress={pausarCronometroCorrida}
                    style={styles.btnPausaPlayCronometroCadastro}
                  >
                    <Pause size={22} color={ui.iconStrong} strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
                {cronometroEstado === 'pausado' ? (
                  <TouchableOpacity
                    accessibilityLabel="Continuar cronômetro"
                    activeOpacity={0.85}
                    onPress={continuarCronometroCorrida}
                    style={styles.btnPausaPlayCronometroCadastro}
                  >
                    <Play size={22} color={ui.iconStrong} strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
                <View style={styles.cronometroBoxCadastro}>
                  {cronometroEstado === 'pausado' ? (
                    <TextInput
                      value={cronometroPausadoTexto}
                      onChangeText={onCronometroPausadoTextoChange}
                      onBlur={onBlurCronometroPausado}
                      selectTextOnFocus
                      accessibilityLabel="Editar tempo do cronômetro (pausado)"
                      placeholder="MM:SS"
                      placeholderTextColor={ui.placeholder}
                      autoCorrect={false}
                      autoComplete="off"
                      spellCheck={false}
                      {...(Platform.OS === 'ios' ? { textContentType: 'none' as const } : {})}
                      keyboardType={
                        Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'
                      }
                      style={[
                        styles.cronometroInputCadastro,
                        Platform.OS === 'web'
                          ? ({ fontVariantNumeric: 'tabular-nums' } as object)
                          : null,
                      ]}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.cronometroTextCadastro,
                        Platform.OS === 'web'
                          ? ({ fontVariantNumeric: 'tabular-nums' } as object)
                          : null,
                      ]}
                    >
                      {tempoExibido}
                    </Text>
                  )}
                </View>
              </View>
              {todosIntegrantesComTempoRegistrado ? (
                <TouchableOpacity
                  accessibilityLabel={`Aplicar resultado da ${tituloProvaCurta.toLowerCase()}`}
                  activeOpacity={0.85}
                  onPress={() => {
                    void onCadastrarResultados();
                  }}
                  disabled={salvandoResultadosCorrida}
                  style={[
                    styles.toggleBtn,
                    styles.toggleBtnActive,
                    styles.btnAplicarResultadoCadastro,
                    salvandoResultadosCorrida ? styles.btnIniciarDisabled : null,
                  ]}
                >
                  {salvandoResultadosCorrida ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Aplicar Resultado</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          </Card>
        ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createAplicarTafStyles(theme: AppTheme, ui: ReturnType<typeof getUiColors>) {
  return StyleSheet.create({
  safe: { flex: 1, position: 'relative' as const },
  scrollContentCadastro: { paddingHorizontal: 16, paddingVertical: 16 },
  centerWrap: { flex: 1, alignItems: 'center' as const },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: PREMIUM.minTouch,
    height: PREMIUM.minTouch,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  pageTitle: {
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    maxWidth: 720,
    marginBottom: 20,
  },
  section: { marginBottom: 20, width: '100%' },
  labelText: {
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: PREMIUM.radiusMd,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '500',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  toggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: PREMIUM.radiusLg,
    borderWidth: 1,
    marginBottom: 20,
  },
  toggleBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: PREMIUM.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnText: {
    fontWeight: '700',
  },
  btnRow: { marginTop: 8, gap: 10 },
  btn: {
    marginTop: 6,
    width: '100%',
    paddingVertical: 14,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontWeight: '700',
  },
  btnVoltarCadastro: { alignSelf: 'flex-start', marginBottom: 14 },
  formSubtitle: {
    marginBottom: 16,
    lineHeight: 19,
  },
  btnOkNip: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: PREMIUM.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIniciarDisabled: {
    opacity: 0.72,
  },
  modalTempoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalTempoCardCadastro: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: ui.modalBg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalRubricaCardCadastro: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 18,
    backgroundColor: ui.modalBg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  modalRubricaSubtituloCadastro: {
    fontSize: 12,
    fontWeight: '800',
    color: ui.text,
    marginBottom: 10,
  },
  modalRubricaLinhaCadastro: {
    fontSize: 13,
    fontWeight: '700',
    color: ui.text,
    marginBottom: 6,
  },
  modalRubricaLinhaStrong: {
    color: ui.text,
    fontWeight: '900',
  },
  modalRubricaLegendaCadastro: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '800',
    color: ui.text,
    marginBottom: 6,
  },
  modalRubricaCanvasWrap: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    height: RUBRICA_CANVAS_HEIGHT,
    overflow: 'hidden',
  },
  modalRubricaBtnSecundario: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: ui.toggleInactiveBg,
  },
  modalRubricaBtnSecundarioText: {
    fontSize: 12,
    fontWeight: '800',
    color: ui.text,
  },
  modalRubricaErroCadastro: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.isDark ? ui.text : '#B91C1C',
  },
  modalTempoMensagemCadastro: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    color: ui.text,
    lineHeight: 22,
  },
  modalTempoParcialCadastro: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: ui.text,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalTempoBtnPrimaryCadastro: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: ui.btnDarkBg,
    alignItems: 'center',
  },
  modalTempoBtnPrimaryTextCadastro: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  btnIniciarCorridaCadastro: {
    flex: 1,
    minWidth: 160,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: ui.toggleInactiveBg,
  },
  btnIniciarCorridaTextCadastro: { color: ui.text, fontSize: 13, fontWeight: '800' },
  btnPausaPlayCronometroCadastro: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: ui.toggleInactiveBg,
  },
  cronometroBoxCadastro: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: ui.inputBg,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cronometroTextCadastro: {
    fontSize: 22,
    fontWeight: '900',
    color: ui.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cronometroInputCadastro: {
    fontSize: 22,
    fontWeight: '900',
    color: ui.text,
    minWidth: 120,
    textAlign: 'center',
    paddingVertical: 0,
    paddingHorizontal: 4,
    borderWidth: 0,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : {}),
  },
  btnAplicarResultadoCadastro: {
    marginTop: 14,
    paddingVertical: 14,
  },
  nipRow: {
    marginBottom: 14,
  },
  nipLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nipInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  inputNipFlex: {
    flex: 1,
    minWidth: 0,
  },
  nomeCorredorBeside: {
    flex: 1,
    flexBasis: 160,
    minWidth: 140,
    justifyContent: 'center',
  },
  nomeCorredorBesideText: {
    fontSize: 13,
    fontWeight: '800',
    color: ui.text,
    lineHeight: 28,
  },
  /** Número do corredor: o dobro do tamanho do texto ao lado, em verde */
  numeroCorredor: {
    fontSize: 26,
    fontWeight: '900',
    color: theme.isDark ? ui.text : theme.success,
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
    marginBottom: 4,
  },
  cronometroBloco: {
    width: '100%',
    marginTop: 16,
  },
  iniciarCorridaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
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
    width: 72,
    paddingRight: 6,
  },
  tabelaColNome: {
    width: 200,
    maxWidth: 200,
    minWidth: 120,
    flexGrow: 0,
    flexShrink: 0,
    paddingRight: 4,
  },
  tabelaColMarcarChegada: {
    width: 128,
    minWidth: 128,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  tabelaColVolta: {
    width: 44,
    minWidth: 44,
    textAlign: 'center',
    paddingHorizontal: 0,
  },
  /** Aproxima a 1ª coluna de volta da coluna Nome (antes havia espaço por flex na Nome). */
  tabelaColVoltaPrimeira: {
    marginLeft: -2,
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
  modalPermanenciaFinalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: ui.modalBg,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  modalPermanenciaFinalTitulo: {
    fontSize: 18,
    fontWeight: '900',
    color: ui.text,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  modalPermanenciaFinalSub: {
    fontSize: 14,
    color: ui.text,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  });
}
