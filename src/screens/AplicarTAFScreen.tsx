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
  AppState,
  type AppStateStatus,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
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
import { AplicarTafFatoresRiscoPanel } from '../components/taf/aplicar/AplicarTafFatoresRiscoPanel';
import { AplicarTafRestritosPanel } from '../components/taf/aplicar/AplicarTafRestritosPanel';
import {
  FatoresRiscoInfoModal,
  FATORES_RISCO_LARANJA,
} from '../components/taf/aplicar/FatoresRiscoInfoModal';
import { AplicarTafProvaSelector } from '../components/taf/aplicar/AplicarTafProvaSelector';
import {
  AplicarTafPreCadastroCard,
  PRE_CADASTRO_ACCENTS,
} from '../components/taf/aplicar/AplicarTafPreCadastroCard';
import { useAplicarTafLayout } from '../components/taf/aplicar/useAplicarTafLayout';
import { TopActionIcons } from '../components/premium/TopActionIcons';
import { AplicarTafModoTesteBar } from '../components/taf/aplicar/AplicarTafModoTesteBar';
import { EditarIdadeGeneroMilitarModal } from '../components/taf/aplicar/EditarIdadeGeneroMilitarModal';
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
import {
  clearProvaAtivaSession,
  loadProvaAtivaSession,
  resolveCronometroElapsedMs,
  saveProvaAtivaSession,
  type ProvaAtivaSessionV1,
} from '../services/provaAtivaSessionStorage';
import { aplicarRubricasEmCadastros } from '../utils/persistirRubricaCadastro';
import { RUBRICA_COR_FUNDO, RUBRICA_COR_TRACO } from '../utils/rubricaSvgNormalize';
import { RUBRICA_NATIVA_ALTURA } from '../utils/rubricaConstants';
import {
  buscarRegistroModalidadeExistente,
  removerParticipanteModalidadeDoHistorico,
} from '../utils/registroModalidadeHistorico';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
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
  aplicarDesistenciaNoCadastro,
} from './aplicarTafNotaHelpers';
import { useTafTimeFormat } from '../hooks/useTafTimeFormat';
import { useTafReactStopwatch } from '../hooks/useTafReactStopwatch';
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
import {
  getAllFatoresRisco,
  listarFatoresRiscoSim,
  temFatorRiscoSim,
  type FatoresRiscoRegistro,
} from '../services/fatoresRiscoStorage';
import { nipDigitos } from '../utils/nipFormat';

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

/** Cronômetro da prova: controlado por react-timer-hook (MM:SS:CS). */

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

/** Exibição na prova ativa: apenas primeiro e segundo nome. */
function primeiroSegundoNome(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return nome.trim();
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[1]}`;
}

/** Sufixo de idade ao lado do nome. */
function textoIdadeMilitar(dataNascimento: string): string {
  const idade = idadeFromDataNascimento(dataNascimento);
  return idade != null ? `${idade} anos` : 'Idade?';
}

function textoGeneroMilitar(sexo?: 'M' | 'F'): string {
  if (sexo === 'M') return 'Masculino';
  if (sexo === 'F') return 'Feminino';
  return 'Gênero?';
}

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
  const [mostrarFatoresRisco, setMostrarFatoresRisco] = useState(false);
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
  const [numeroVoltas, setNumeroVoltas] = useState('');
  /** Corrida/caminhada: número de voltas já confirmado (também persistido na sessão). */
  const [voltasConfirmadasProva, setVoltasConfirmadasProva] = useState(false);
  /** Voltas, chegadas e tempos em um único reducer (atualização atômica por clique). */
  const [trialTable, dispatchTrial] = useReducer(aplicarTafTrialReducer, initialTrialTableState);
  const { checksVoltas, chegadaNatacao, temposMilitaresMs, desistenciaParticipantes } = trialTable;
  const [continuidadeProvaVisible, setContinuidadeProvaVisible] = useState(false);
  const [continuidadeProvaMeta, setContinuidadeProvaMeta] = useState<{
    provaLabel: string;
    participantesCount: number;
  } | null>(null);
  const suppressPersistProvaRef = useRef(false);
  const provaAtivaRestauradaRef = useRef(false);

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

  const [resultadoPermanenciaLinhas, setResultadoPermanenciaLinhas] = useState<
    ResultadoPermanenciaOpcao[]
  >([]);
  const [modalPermanenciaFinalizadaVisible, setModalPermanenciaFinalizadaVisible] =
    useState(false);
  const [erroPermanencia, setErroPermanencia] = useState('');

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
    tipoProva === 'natacao' || tipoProva === 'abdominal_prancha'
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
        out.push('REPROVADO');
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
    dispatchTrial({ type: 'setDesistencia', participante, value: true });
  }, []);

  const limparDesistenciaParticipante = useCallback((participante: number) => {
    dispatchTrial({ type: 'setDesistencia', participante, value: false });
  }, []);

  const limparBufferAplicacao = useCallback(() => {
    pendingCadastrosRef.current = [];
    pendingCleanupsRef.current = [];
    resultadosPosMilitaresRef.current = null;
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
      listaResultadosRubricaNatacao ??
      resultadosPosMilitaresRef.current ??
      pendingResultadosNavRef.current;
    if (fluxoAplicadorVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'aplicador',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
      };
    } else if (modalRubricaNatacaoVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'rubrica_candidatos',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
        indiceRubrica: indiceRubricaNatacao,
        listaResultadosRubrica: (listaResultadosRubricaNatacao ?? resultadosPendentes).map(
          (r) => ({ ...r }),
        ),
      };
    } else if (modalTempoRegistradoVisible && resultadosPendentes) {
      finalizacao = {
        fase: 'tempo_registrado',
        resultados: resultadosPendentes.map((r) => ({ ...r })),
        pendingCadastros: pendingCadastrosRef.current.map((c) => ({ ...c })),
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
      setModalTesteExistente(null);
      setNumeroVoltas(session.numeroVoltas ?? '');
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
        const resultados = fin.resultados.map((r) => ({ ...r }));
        resultadosPosMilitaresRef.current = resultados;
        pendingResultadosNavRef.current = resultados;
        if (fin.fase === 'rubrica_candidatos') {
          const lista = (fin.listaResultadosRubrica ?? resultados).map((r) => ({ ...r }));
          setListaResultadosRubricaNatacao(lista);
          setIndiceRubricaNatacao(fin.indiceRubrica ?? 0);
          setErroRubricaNatacao('');
          setRubricaStrokes([]);
          setRubricaStrokeAtual([]);
          setModalRubricaNatacaoVisible(true);
          setFluxoAplicadorVisible(false);
          setModalTempoRegistradoVisible(false);
        } else if (fin.fase === 'aplicador') {
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

      setContinuidadeProvaMeta({
        provaLabel: tituloProvaTaf(tipo, session.modoTafNaval),
        participantesCount: session.nipsParticipantes.length,
      });
      setContinuidadeProvaVisible(true);

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
    [stopwatch.restaurar, limparBufferAplicacao],
  );

  const descartarSessaoProvaAtivaRestaurada = useCallback(() => {
    suppressPersistProvaRef.current = true;
    setContinuidadeProvaVisible(false);
    setContinuidadeProvaMeta(null);
    limparBufferAplicacao();
    setListaResultadosRubricaNatacao(null);
    setModalRubricaNatacaoVisible(false);
    setFluxoAplicadorVisible(false);
    setModalTempoRegistradoVisible(false);
    resetCronometroCorrida();
    dispatchTrial({ type: 'resetAll' });
    setRepeticoesParticipantes([]);
    setResultadoPermanenciaLinhas([]);
    setNumeroVoltas('');
    setVoltasConfirmadasProva(false);
    setNipsParticipantes([]);
    setNipFeedbackLinhas([]);
    setTipoProva(null);
    tipoProvaRef.current = null;
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
   * Grava DE FATO no sistema tudo que estava pendente (notas no cadastro, limpezas de
   * histórico e a sessão) — somente após o aplicador confirmar senha + rúbrica.
   * No Modo Teste: só a sessão (demo-sess-*), sem alterar cadastros reais.
   */
  const commitAplicacao = useCallback(
    async (
      resultados: ResultadoCorridaItem[],
      assinatura: AplicadorAssinaturaResumo,
    ): Promise<void> => {
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
      limparSessaoProvaAtiva();
      setFluxoAplicadorVisible(false);
      if (res) {
        navigation.navigate('CadastrarResultados', {
          resultados: res,
          aplicadorAssinatura: assinatura,
          returnTo: 'AplicarTAF',
        });
      }
    },
    [navigation, commitAplicacao, limparBufferAplicacao, limparSessaoProvaAtiva],
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
            limparSessaoProvaAtiva();
            setFluxoAplicadorVisible(false);
          },
        },
      ],
    );
  }, [limparBufferAplicacao, limparSessaoProvaAtiva]);

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
        resultados.push({
          corredor: i + 1,
          nome: nomeBase,
          tempoMs: 0,
          nip,
          prova,
          desempenhoTexto: 'Desistência',
          notaTexto: 'REPROVADO',
          noraTexto: 'REPROVADO',
          reprovacaoTexto: 'Desistência',
          desistencia: true,
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
        const atualizado = r.desistencia && (prova === 'corrida' || prova === 'natacao')
          ? aplicarDesistenciaNoCadastro(busca.cadastro, prova, { modoTafNaval })
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
    desistenciaParticipantes,
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
    setNipsParticipantes((prev) => [...prev, '']);
    setNipFeedbackLinhas((prev) => [...prev, null]);
  }, [modoPreCadastro, tipoProva, nipsParticipantes.length]);

  const removerParticipanteNip = useCallback((index: number) => {
    setErroParticipantes('');
    setParticipanteNipParaExcluir(null);
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

  const confirmarExclusaoParticipanteNip = useCallback(() => {
    if (participanteNipParaExcluir == null) return;
    removerParticipanteNip(participanteNipParaExcluir);
  }, [participanteNipParaExcluir, removerParticipanteNip]);

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
    (index: number, patch: Partial<{ dataNascimento: string; sexo: 'M' | 'F' }>) => {
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

  const salvarEdicaoIdadeGenero = useCallback(
    async (dados: { dataNascimento: string; sexo: 'M' | 'F' }) => {
      if (isModoDemonstracaoAtivo()) {
        throw new Error('No Modo Teste não é permitido alterar idade ou gênero.');
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
        dataNascimento: dados.dataNascimento,
        sexo: dados.sexo,
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
      getElapsedRaceMs() ??
      PERMANENCIA_DURACAO_MS;
    const tempoStr = formatMsByModality('corrida', tempoMs);

    try {
      let cadastrosInicial = await getAllCadastros({ includeDemo: true });
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
    setVoltasConfirmadasProva(false);
    setCorridaEtapa('nips');
    limparSessaoProvaAtiva();
  }, [resetCronometroCorrida, limparSessaoProvaAtiva]);

  const recarregarListaPreCadastros = useCallback(async () => {
    const lista = await getAllPreCadastrosTaf();
    setListaPreCadastros(lista);
  }, []);

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
      if (!reg || !temFatorRiscoSim(reg.respostas)) return;
      const fb = nipFeedbackLinhas[index];
      const nome =
        fb?.tipo === 'ok' || fb?.tipo === 'completar_dados'
          ? fb.nomeMilitar
          : reg.nome || `Participante ${index + 1}`;
      setModalFatoresRiscoInfo({
        nome,
        nip: key,
        fatores: listarFatoresRiscoSim(reg.respostas),
      });
    },
    [nipsParticipantes, fatoresRiscoPorNip, nipFeedbackLinhas],
  );

  const participanteTemFatorRisco = useCallback(
    (index: number): boolean => {
      const key = nipDigitos(nipsParticipantes[index] ?? '');
      if (!key) return false;
      return temFatorRiscoSim(fatoresRiscoPorNip[key]?.respostas);
    },
    [nipsParticipantes, fatoresRiscoPorNip],
  );

  const voltarInicioAplicarTaf = useCallback(() => {
    setMostrarListaPreCadastro(false);
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
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
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
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
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
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
      setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
      setMostrarProvas(true);
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
      setVoltasConfirmadasProva(false);
      resetCronometroCorrida();

      if (tipo === 'permanencia') {
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
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
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
    setMostrarFatoresRisco(false);
    setMostrarRestritos(false);
    tipoProvaRef.current = null;
    resetCronometroCorrida();
    setMostrarProvas(true);
    setTipoProva(null);
    setCorridaEtapa('menu');
    setErroParticipantes('');
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
        return fb?.tipo === 'ok' ? primeiroSegundoNome(fb.nomeMilitar) : '—';
      }),
    [nParticipantesConfirmado, nipFeedbackLinhas],
  );

  const participantesComFatorRiscoModal = useMemo(
    () =>
      Array.from({ length: nParticipantesConfirmado }, (_, index) => {
        const key = nipDigitos(nipsParticipantes[index] ?? '');
        return key ? temFatorRiscoSim(fatoresRiscoPorNip[key]?.respostas) : false;
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
        visible={modalRubricaNatacaoVisible && !continuidadeProvaVisible}
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
        visible={fluxoAplicadorVisible && !continuidadeProvaVisible}
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
              onBack={() => navigation.goBack()}
            />
          )}

          {!mostrarProvas && !mostrarListaPreCadastro && !mostrarFatoresRisco && !mostrarRestritos ? (
            <AplicarTafHomeLauncher
              onIniciarTaf={iniciarTaf}
              onIniciarTafNaval={iniciarTafNaval}
              onPreCadastro={abrirListaPreCadastro}
              onFatoresRisco={abrirFatoresRisco}
              onRestritos={abrirRestritos}
            />
          ) : null}

          {mostrarFatoresRisco ? (
            <AplicarTafFatoresRiscoPanel
              onVoltar={voltarInicioAplicarTaf}
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
                listaPreCadastros.map((pre, index) => (
                  <AplicarTafPreCadastroCard
                    key={pre.id}
                    numero={index + 1}
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

        {mostrarProvas && corridaEtapa === 'nips' ? (
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
                    : 'Informe o NIP de cada participante. Use Adicionar Participante para incluir mais.'
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
                  <View style={styles.nipLabelRow}>
                    <LabelNip color={ui.label} fontSize={11} fontWeight="800" />
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`Remover participante ${index + 1}`}
                      onPress={() => setParticipanteNipParaExcluir(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.nipTrashBtn}
                    >
                      <Trash2 size={18} color={theme.loss} strokeWidth={2.3} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.nipInputRow}>
                    <AplicarTafInput
                      value={nip}
                      onChangeText={(t) => atualizarNip(index, t)}
                      placeholder="00.0000.00"
                      keyboardType="number-pad"
                      style={[
                        styles.inputNipFlex,
                        demoAtivo ? { opacity: 0.85 } : null,
                      ]}
                      autoCorrect={false}
                      spellCheck={false}
                      editable={!demoAtivo}
                      accessibilityLabel={`NIP do participante ${index + 1}`}
                      accessibilityState={{ disabled: demoAtivo }}
                    />
                    {!demoAtivo ? (
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
                          <Text style={[styles.nipOkBtnText, { color: theme.tokens.textOnPrimary }]}>
                            OK
                          </Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {fb?.tipo === 'ok' ? (
                  <View
                    style={[
                      styles.militarIdentityCard,
                      participanteTemFatorRisco(index)
                        ? {
                            borderColor: theme.isDark
                              ? 'rgba(234,88,12,0.55)'
                              : 'rgba(234,88,12,0.45)',
                            borderWidth: 2,
                            backgroundColor: theme.isDark
                              ? 'rgba(234,88,12,0.1)'
                              : 'rgba(255,247,237,0.85)',
                          }
                        : {
                            borderColor: theme.isDark
                              ? 'rgba(34,197,94,0.35)'
                              : 'rgba(22,163,74,0.22)',
                            backgroundColor: theme.isDark
                              ? 'rgba(34,197,94,0.08)'
                              : 'rgba(220,252,231,0.45)',
                          },
                    ]}
                  >
                    <LinearGradient
                      colors={
                        participanteTemFatorRisco(index)
                          ? theme.isDark
                            ? ['rgba(234,88,12,0.55)', 'rgba(251,146,60,0.25)']
                            : ['rgba(234,88,12,0.7)', 'rgba(251,146,60,0.4)']
                          : theme.isDark
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
                          {
                            backgroundColor: participanteTemFatorRisco(index)
                              ? theme.isDark
                                ? 'rgba(234,88,12,0.22)'
                                : 'rgba(254,215,170,0.7)'
                              : theme.isDark
                                ? 'rgba(34,197,94,0.22)'
                                : PREMIUM.accentMuted,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.militarNumOrbText,
                            {
                              color: participanteTemFatorRisco(index)
                                ? FATORES_RISCO_LARANJA
                                : theme.success,
                            },
                          ]}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.militarNomeCol}>
                        <Text style={[styles.militarRoleLabel, { color: theme.textSecondary }]}>
                          {labelAtleta}
                        </Text>
                        <Text
                          accessibilityRole={
                            participanteTemFatorRisco(index) ? 'button' : undefined
                          }
                          accessibilityHint={
                            participanteTemFatorRisco(index)
                              ? 'Abre os fatores de risco deste militar'
                              : undefined
                          }
                          onPress={
                            participanteTemFatorRisco(index)
                              ? () => abrirModalFatoresRiscoParticipante(index)
                              : undefined
                          }
                          style={[
                            styles.militarNomeText,
                            {
                              color: participanteTemFatorRisco(index)
                                ? FATORES_RISCO_LARANJA
                                : ui.text,
                              textDecorationLine: participanteTemFatorRisco(index)
                                ? 'underline'
                                : 'none',
                            },
                          ]}
                          numberOfLines={2}
                        >
                          {fb.nomeMilitar}
                        </Text>
                        <View style={styles.militarMetaRow}>
                          {demoAtivo ? (
                            <>
                              <View
                                style={[
                                  styles.militarMetaChip,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(15,23,42,0.04)',
                                    opacity: 0.9,
                                  },
                                ]}
                                accessibilityLabel={`Idade: ${textoIdadeMilitar(fb.dataNascimento)}`}
                              >
                                <Text
                                  style={[
                                    styles.militarMetaChipText,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {textoIdadeMilitar(fb.dataNascimento)}
                                </Text>
                              </View>
                              <View
                                style={[
                                  styles.militarMetaChip,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(15,23,42,0.04)',
                                    opacity: 0.9,
                                  },
                                ]}
                                accessibilityLabel={`Gênero: ${textoGeneroMilitar(fb.sexo)}`}
                              >
                                <Text
                                  style={[
                                    styles.militarMetaChipText,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {textoGeneroMilitar(fb.sexo)}
                                </Text>
                              </View>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Editar idade"
                                accessibilityHint="Abre edição de idade e gênero"
                                onPress={() => setModalEditarIdadeGeneroIndex(index)}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={[
                                  styles.militarMetaChip,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(15,23,42,0.04)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.militarMetaChipText,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {textoIdadeMilitar(fb.dataNascimento)}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Editar gênero"
                                accessibilityHint="Abre edição de idade e gênero"
                                onPress={() => setModalEditarIdadeGeneroIndex(index)}
                                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                style={[
                                  styles.militarMetaChip,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? 'rgba(255,255,255,0.06)'
                                      : 'rgba(15,23,42,0.04)',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.militarMetaChipText,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {textoGeneroMilitar(fb.sexo)}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                      <View
                        style={[
                          styles.militarHashBadge,
                          {
                            backgroundColor: participanteTemFatorRisco(index)
                              ? theme.isDark
                                ? 'rgba(234,88,12,0.18)'
                                : 'rgba(254,215,170,0.55)'
                              : theme.isDark
                                ? 'rgba(56,189,248,0.15)'
                                : 'rgba(37,99,235,0.1)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.militarHashText,
                            {
                              color: participanteTemFatorRisco(index)
                                ? FATORES_RISCO_LARANJA
                                : theme.primary,
                            },
                          ]}
                        >
                          #{index + 1}
                        </Text>
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

            {erroParticipantes ? <Text style={styles.erroText}>{erroParticipantes}</Text> : null}
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
        nome={modalEditarOk?.nomeMilitar ?? ''}
        nip={
          modalEditarIdadeGeneroIndex != null
            ? (nipsParticipantes[modalEditarIdadeGeneroIndex] ?? '')
            : ''
        }
        dataNascimento={modalEditarOk?.dataNascimento ?? ''}
        sexo={modalEditarOk?.sexo}
        onClose={() => setModalEditarIdadeGeneroIndex(null)}
        onSalvar={salvarEdicaoIdadeGenero}
      />

      <ConfirmacaoExcluirParticipanteNipModal
        visible={participanteNipParaExcluir != null}
        index={participanteNipParaExcluir ?? 0}
        nip={nipExclusaoParticipante}
        nome={nomeExclusaoParticipante}
        onClose={() => setParticipanteNipParaExcluir(null)}
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
        checksVoltas={checksVoltas}
        chegadaNatacao={chegadaNatacao}
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
        participantesComFatorRisco={participantesComFatorRiscoModal}
        onPressNomeParticipante={abrirModalFatoresRiscoParticipante}
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
  identTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  identTopBack: {
    flex: 1,
    minWidth: 0,
  },
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
  nipLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nipTrashBtn: {
    padding: 4,
    borderRadius: 8,
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
  militarMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  militarMetaChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  militarMetaChipText: {
    fontSize: 12,
    fontWeight: '700',
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
