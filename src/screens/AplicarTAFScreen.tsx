import React, { useState, useCallback, useMemo, useEffect, useRef, useReducer } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { Card } from '../components/Card';
import { LabelNip } from '../components/LabelNip';
import { getAllCadastros, addCadastro, type CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { buscarCadastroPorNomeOuNip } from '../utils/buscarCadastroPorNomeOuNip';
import { formatMsByModality, parseTafPerformanceInput } from '../taf/tafTimeFormat';
import { textoNotaCorrida } from '../taf/corrida2400Nota';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
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

type CorridaEtapa = 'menu' | 'participantes' | 'nips' | 'tabela_corrida';

type TipoProvaTAF = 'corrida' | 'natacao';

/** Cronômetro da corrida: pode pausar e retomar antes de parar de vez. */
type CronometroCorridaEstado = 'inicial' | 'rodando' | 'pausado' | 'finalizado';

type NipFeedbackLinha =
  | { tipo: 'ok'; texto: string; nomeMilitar: string; dataNascimento: string; sexo?: 'M' | 'F' }
  | { tipo: 'erro'; texto: string }
  | null;

const MAX_VOLTAS_COLUNAS = 99;

export default function AplicarTAFScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  /** Mesmos tokens visuais da página Cadastro (CadastroScreenModern). */
  const grayBg = theme.background;
  const cardGlassEnabled = Platform.OS === 'web';
  const inputBg = '#FFFFFF';
  const inputBorder = 'rgba(17,24,39,0.12)';
  const inputTextColor = '#111827';
  const [mostrarProvas, setMostrarProvas] = useState(false);
  const [tipoProva, setTipoProva] = useState<TipoProvaTAF | null>(null);
  const tipoProvaRef = useRef<TipoProvaTAF | null>(null);
  useEffect(() => {
    tipoProvaRef.current = tipoProva;
  }, [tipoProva]);
  const { formatMs, parseInput } = useTafTimeFormat(tipoProva);
  const [corridaEtapa, setCorridaEtapa] = useState<CorridaEtapa>('menu');
  const [numeroParticipantesCorrida, setNumeroParticipantesCorrida] = useState('');
  const [erroParticipantes, setErroParticipantes] = useState('');
  const [nParticipantesConfirmado, setNParticipantesConfirmado] = useState(0);
  const [nipsParticipantes, setNipsParticipantes] = useState<string[]>([]);
  const [nipFeedbackLinhas, setNipFeedbackLinhas] = useState<NipFeedbackLinha[]>([]);
  const [numeroVoltas, setNumeroVoltas] = useState('');
  /** Voltas, chegadas e tempos em um único reducer (atualização atômica por clique). */
  const [trialTable, dispatchTrial] = useReducer(aplicarTafTrialReducer, initialTrialTableState);
  const { checksVoltas, chegadaNatacao, temposMilitaresMs } = trialTable;

  /** Após “Aplicar Resultado”: tempos gravados no cadastro. */
  const [salvandoResultadosCorrida, setSalvandoResultadosCorrida] = useState(false);
  const [modalTempoRegistradoVisible, setModalTempoRegistradoVisible] = useState(false);
  const [modalParcialAviso, setModalParcialAviso] = useState<string | null>(null);
  const pendingResultadosNavRef = useRef<ResultadoCorridaItem[] | null>(null);

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

  const tickCronometroDisplay = useCallback(() => {
    if (cronometroInicioRef.current == null) return;
    const ms = segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    setTempoExibido(formatMsByModality(tipoProvaRef.current ?? 'corrida', ms));
  }, []);

  const getElapsedRaceMs = useCallback((): number | null => {
    if (cronometroEstado === 'rodando' && cronometroInicioRef.current != null) {
      return segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    }
    if (cronometroEstado === 'pausado') {
      const mod = tipoProvaRef.current ?? 'corrida';
      const parsed = parseTafPerformanceInput(mod, cronometroPausadoTextoRef.current.trim());
      if (parsed != null) return parsed;
      return segmentoAcumuladoMsRef.current;
    }
    if (cronometroEstado === 'finalizado' && tempoParadoMsRef.current != null) {
      return tempoParadoMsRef.current;
    }
    return null;
  }, [cronometroEstado]);

  const aplicarTempoCronometroPausado = useCallback((): boolean => {
    const ms = parseInput(cronometroPausadoTexto.trim());
    if (ms == null) {
      Alert.alert(
        'Tempo inválido',
        tipoProva === 'natacao'
          ? 'Use segundos inteiros (ex.: 66 ou 66s).'
          : 'Use MM:SS ou HH:MM:SS (ex.: 05:30 ou 01:05:30). Segundos entre 00 e 59.',
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
    setCronometroEstado('inicial');
    const z = formatMsByModality(tipoProvaRef.current ?? 'corrida', 0);
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
    const fmtParado = formatMsByModality(tipoProvaRef.current ?? 'corrida', totalMs);
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

  /** Coluna “Tempo”: corrida = alguém marcou última volta; natação = alguém marcou chegada. */
  const mostrarColunaTempo = useMemo(() => {
    if (tipoProva === 'natacao') {
      return chegadaNatacao.some(Boolean);
    }
    if (nColunasVoltas < 1) return false;
    const ultima = nColunasVoltas - 1;
    return checksVoltas.some((row) => row?.[ultima]);
  }, [tipoProva, chegadaNatacao, nColunasVoltas, checksVoltas]);

  /** Nota (corrida masculina): exige coluna de tempo visível. */
  const mostrarColunaNotaCorrida = tipoProva === 'corrida' && mostrarColunaTempo;

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
      const idade = idadeFromDataNascimento(fb.dataNascimento);
      out.push(textoNotaCorrida(ms, idade, fb.sexo));
    }
    return out;
  }, [
    mostrarColunaNotaCorrida,
    nParticipantesConfirmado,
    nipFeedbackLinhas,
    temposMilitaresMs,
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
      return w;
    }
    let w = wAtleta + wNome + nColunasVoltas * wVolta + 24;
    if (mostrarColunaTempo) w += wTempo;
    if (mostrarColunaNotaCorrida) w += wNota;
    return w;
  }, [tipoProva, nColunasVoltas, mostrarColunaTempo, mostrarColunaNotaCorrida]);

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
    if (cronometroEstado === 'pausado') {
      const parsed = parseTafPerformanceInput(
        tipoProvaRef.current ?? 'corrida',
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
    const fmt = formatMsByModality(tipoProvaRef.current ?? 'corrida', totalMs);
    setTempoExibido(fmt);
    setCronometroPausadoTexto(fmt);
    cronometroPausadoTextoRef.current = fmt;
    setCronometroEstado('finalizado');
  }, [todosIntegrantesComTempoRegistrado, cronometroEstado]);

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
      dispatchTrial({
        type: 'toggleNatacaoChegada',
        participante,
        elapsedMs: getElapsedRaceMs(),
      });
    },
    [getElapsedRaceMs],
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
        const fb = nipFeedbackLinhas[i];
        if (fb?.tipo === 'ok' && temposMilitaresMs[i] != null) {
          const idade = idadeFromDataNascimento(fb.dataNascimento);
          const t = textoNotaCorrida(temposMilitaresMs[i]!, idade, fb.sexo);
          notaTexto = t === '—' ? undefined : t;
        }
      }

      resultados.push({
        corredor: i + 1,
        nome: nomeBase,
        tempoMs,
        nip,
        prova,
        notaTexto,
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
        const atualizado: CadastroItemPersist =
          prova === 'natacao'
            ? { ...busca.cadastro, tempoNatacao: tempoStr }
            : (() => {
                const idade = idadeFromDataNascimento(busca.cadastro.dataNascimento);
                const notaStr = textoNotaCorrida(r.tempoMs, idade, busca.cadastro.sexo);
                const notaCorrida = notaStr === '—' ? undefined : notaStr;
                return {
                  ...busca.cadastro,
                  tempoCorrida: tempoStr,
                  notaCorrida,
                };
              })();
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
        setModalParcialAviso(avisoParcial);
        setModalTempoRegistradoVisible(true);
      } else {
        Alert.alert(
          'Nenhum registro',
          `Não foi possível localizar no cadastro: ${naoEncontrados.slice(0, 5).join(', ')}${naoEncontrados.length > 5 ? '…' : ''}.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('CadastrarResultados', { resultados }),
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
        [{ text: 'OK', onPress: () => navigation.navigate('CadastrarResultados', { resultados }) }],
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
  ]);

  const fecharModalTempoRegistrado = useCallback(() => {
    setModalTempoRegistradoVisible(false);
    setModalParcialAviso(null);
    const res = pendingResultadosNavRef.current;
    pendingResultadosNavRef.current = null;
    if (res) {
      navigation.navigate('CadastrarResultados', { resultados: res });
    }
  }, [navigation]);

  const onChangeParticipantes = useCallback((text: string) => {
    const apenasDigitos = text.replace(/\D/g, '');
    setNumeroParticipantesCorrida(apenasDigitos);
    setErroParticipantes('');
  }, []);

  const abrirCorrida = useCallback(() => {
    setTipoProva('corrida');
    setCorridaEtapa('participantes');
  }, []);

  const abrirNatacao = useCallback(() => {
    setTipoProva('natacao');
    setCorridaEtapa('participantes');
  }, []);

  const voltarMenuProvas = useCallback(() => {
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

    setNipFeedbackLinhas((prev) => {
      const next = [...prev];
      if (resultado.kind === 'found') {
        const nome = (resultado.cadastro.nome || '').trim() || 'Sem nome';
        const c = resultado.cadastro;
        next[index] = {
          tipo: 'ok',
          texto: 'Militar Cadastrado no Sistema.',
          nomeMilitar: nome,
          dataNascimento: c.dataNascimento || '',
          sexo: c.sexo,
        };
      } else if (resultado.kind === 'none') {
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
  }, [nipsParticipantes]);

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
      tipoProva,
    });
    setCorridaEtapa('tabela_corrida');
  }, [resetCronometroCorrida, nParticipantesConfirmado, tipoProva]);

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
    setNumeroVoltas('');
    dispatchTrial({ type: 'resetAll' });
  }, [resetCronometroCorrida]);

  const tituloProvaCurta = tipoProva === 'natacao' ? 'Natação' : 'Corrida';
  const labelAtleta = tipoProva === 'natacao' ? 'Nadador' : 'Corredor';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: grayBg }]}>
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
              <ChevronLeft size={26} color="#6B7280" strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.pageTitle}>Aplicar TAF</Text>
            </View>
          </View>

          {!mostrarProvas ? (
            <View style={styles.toggleStack}>
              <TouchableOpacity
                accessibilityLabel="Iniciar TAF"
                activeOpacity={0.85}
                onPress={iniciarTaf}
                style={[styles.toggleBtn, styles.toggleBtnActive]}
              >
                <Text style={[styles.toggleBtnText, styles.toggleBtnTextActive]}>Iniciar TAF</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        {mostrarProvas && corridaEtapa === 'menu' ? (
          <Card glass={cardGlassEnabled} style={styles.formCard}>
            <View style={styles.sectionCadastro}>
              <Text style={styles.sectionTitleCadastro}>Selecione a prova</Text>
              <TouchableOpacity
                accessibilityLabel="Corrida"
                activeOpacity={0.85}
                onPress={abrirCorrida}
                style={styles.toggleBtn}
              >
                <Text style={styles.toggleBtnText}>Corrida</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Natação"
                activeOpacity={0.85}
                onPress={abrirNatacao}
                style={[styles.toggleBtn, styles.toggleBtnSpacing]}
              >
                <Text style={styles.toggleBtnText}>Natação</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Permanência"
                activeOpacity={0.85}
                onPress={() => {}}
                style={[styles.toggleBtn, styles.toggleBtnSpacing]}
              >
                <Text style={styles.toggleBtnText}>Permanência</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'participantes' ? (
          <Card glass={cardGlassEnabled} style={styles.formCard}>
            <View style={styles.sectionCadastro}>
              <TouchableOpacity
                accessibilityLabel="Voltar para seleção de provas"
                activeOpacity={0.85}
                onPress={voltarMenuProvas}
                style={styles.btnVoltarCadastro}
              >
                <Text style={styles.btnVoltarText}>← Voltar</Text>
              </TouchableOpacity>

              <Text style={styles.labelTextCadastro}>Número de Participantes</Text>
              <TextInput
                value={numeroParticipantesCorrida}
                onChangeText={onChangeParticipantes}
                placeholder="0"
                placeholderTextColor="rgba(17,24,39,0.35)"
                keyboardType="number-pad"
                maxLength={5}
                style={[
                  styles.inputCadastro,
                  { borderColor: inputBorder, backgroundColor: inputBg, color: inputTextColor },
                ]}
                autoCorrect={false}
                spellCheck={false}
                accessibilityLabel={`Número de participantes da ${tituloProvaCurta.toLowerCase()}`}
              />
              {erroParticipantes ? <Text style={styles.erroText}>{erroParticipantes}</Text> : null}

              <TouchableOpacity
                accessibilityLabel="Confirmar número de participantes"
                activeOpacity={0.85}
                onPress={confirmarParticipantes}
                style={styles.btnCadastro}
              >
                <Text style={styles.btnCadastroText}>OK</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'nips' ? (
          <Card glass={cardGlassEnabled} style={styles.formCard}>
            <View style={styles.sectionCadastro}>
              <TouchableOpacity
                accessibilityLabel="Voltar para número de participantes"
                activeOpacity={0.85}
                onPress={voltarParticipantes}
                style={styles.btnVoltarCadastro}
              >
                <Text style={styles.btnVoltarText}>← Voltar</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitleCadastro}>
                {tituloProvaCurta} — NIPs dos participantes
              </Text>
              <Text style={styles.formSubtitleCadastro}>
                Preencha o NIP de cada um dos {nParticipantesConfirmado} participantes.
              </Text>

            {nipsParticipantes.map((nip, index) => (
              <View key={index} style={styles.nipRow}>
                <View style={styles.nipLabelRow}>
                  <LabelNip color="#374151" fontSize={12} fontWeight="800" />
                </View>
                <View style={styles.nipInputRow}>
                  <TextInput
                    value={nip}
                    onChangeText={(t) => atualizarNip(index, t)}
                    placeholder="00.0000.00"
                    placeholderTextColor="rgba(17,24,39,0.35)"
                    keyboardType="number-pad"
                    style={[
                      styles.inputCadastro,
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
                    style={styles.btnOkNipCadastro}
                  >
                    <Text style={styles.btnCadastroText}>OK</Text>
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
              onPress={prepararProva}
              style={styles.btnPrepararCorridaCadastro}
            >
              <Text style={styles.btnCadastroText}>Preparar {tituloProvaCurta}</Text>
            </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        {mostrarProvas && corridaEtapa === 'tabela_corrida' ? (
          <Card glass={cardGlassEnabled} style={styles.formCard}>
            <View style={styles.sectionCadastro}>
            <TouchableOpacity
              accessibilityLabel="Voltar para edição dos NIPs"
              activeOpacity={0.85}
              onPress={voltarDeTabelaParaNips}
              style={styles.btnVoltarCadastro}
            >
              <Text style={styles.btnVoltarText}>← Voltar</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitleCadastro}>
              {tipoProva === 'natacao' ? 'Natação preparada' : 'Corrida preparada'}
            </Text>

            {tipoProva === 'corrida' ? (
              <>
                <Text style={styles.labelTextCadastro}>Número de Voltas</Text>
                <TextInput
                  value={numeroVoltas}
                  onChangeText={onChangeNumeroVoltas}
                  placeholder="0"
                  placeholderTextColor="rgba(17,24,39,0.35)"
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[
                    styles.inputCadastro,
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
                        index > 0 ? { borderTopWidth: 1, borderTopColor: 'rgba(17,24,39,0.08)' } : null,
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
                    <Pause size={22} color="#111827" strokeWidth={2.5} />
                  </TouchableOpacity>
                ) : null}
                {cronometroEstado === 'pausado' ? (
                  <TouchableOpacity
                    accessibilityLabel="Continuar cronômetro"
                    activeOpacity={0.85}
                    onPress={continuarCronometroCorrida}
                    style={styles.btnPausaPlayCronometroCadastro}
                  >
                    <Play size={22} color="#111827" strokeWidth={2.5} />
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
                      placeholder={tipoProva === 'natacao' ? 'Segundos (ex: 66s)' : 'MM:SS'}
                      placeholderTextColor="rgba(17,24,39,0.35)"
                      keyboardType={
                        tipoProva === 'natacao'
                          ? 'number-pad'
                          : Platform.OS === 'ios'
                            ? 'numbers-and-punctuation'
                            : 'default'
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

const styles = StyleSheet.create({
  safe: { flex: 1, position: 'relative' as const },
  scrollContentCadastro: { paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 28 },
  centerWrap: { flex: 1, alignItems: 'center' as const },
  headerRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: { flex: 1 },
  pageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textShadowColor: 'rgba(0,0,0,0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  formCard: {
    width: '100%',
    maxWidth: 720,
    marginTop: 8,
    padding: 18,
    borderRadius: 20,
  },
  sectionCadastro: { marginBottom: 0, width: '100%' },
  sectionTitleCadastro: {
    fontSize: 14,
    fontWeight: '800',
    color: 'rgba(17,24,39,0.8)',
    marginBottom: 14,
  },
  labelTextCadastro: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 10,
  },
  inputCadastro: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  toggleStack: {
    width: '100%',
    maxWidth: 720,
    alignItems: 'stretch',
    padding: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 30px rgba(17,24,39,0.10)' } as object)
      : {}),
  },
  toggleBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.08)',
    backgroundColor: 'rgba(17,24,39,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnSpacing: { marginTop: 10 },
  toggleBtnActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  toggleBtnText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '800',
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  btnCadastro: {
    marginTop: 8,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCadastroText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  btnVoltarCadastro: { alignSelf: 'flex-start', marginBottom: 14 },
  formSubtitleCadastro: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 16,
    lineHeight: 19,
  },
  btnOkNipCadastro: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
  },
  btnPrepararCorridaCadastro: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#374151',
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
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
  },
  modalTempoMensagemCadastro: {
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    color: '#111827',
    lineHeight: 22,
  },
  modalTempoParcialCadastro: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 19,
  },
  modalTempoBtnPrimaryCadastro: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.12)',
    backgroundColor: '#111827',
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
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  btnIniciarCorridaTextCadastro: { color: '#111827', fontSize: 13, fontWeight: '800' },
  btnPausaPlayCronometroCadastro: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  cronometroBoxCadastro: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.10)',
    backgroundColor: '#FFFFFF',
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cronometroTextCadastro: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  cronometroInputCadastro: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
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
    color: '#111827',
    lineHeight: 28,
  },
  /** Número do corredor: o dobro do tamanho do texto ao lado, em verde */
  numeroCorredor: {
    fontSize: 26,
    fontWeight: '900',
    color: '#15803D',
  },
  feedbackOk: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  feedbackErro: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  btnVoltarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#374151',
  },
  erroText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
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
    borderBottomColor: 'rgba(17,24,39,0.15)',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(17,24,39,0.04)',
  },
  tabelaHeaderCell: {
    fontSize: 12,
    fontWeight: '900',
    color: '#374151',
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
    color: '#111827',
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
    color: '#B91C1C',
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
    borderColor: 'rgba(17,24,39,0.25)',
    backgroundColor: 'transparent',
  },
  checkVoltaBoxOn: {
    borderColor: '#15803D',
    backgroundColor: '#15803D',
  },
  tabelaNumeroVerde: {
    fontSize: 26,
    fontWeight: '900',
    color: '#15803D',
  },
});
