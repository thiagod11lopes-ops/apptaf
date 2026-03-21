import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import { formatElapsedMs } from '../utils/formatRaceTime';
import type { RootStackParamList, ResultadoCorridaItem } from '../navigation/AppNavigator';
import { Check, ChevronLeft, Pause, Play } from 'lucide-react-native';

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
  | { tipo: 'ok'; texto: string; nomeMilitar: string }
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
  const [corridaEtapa, setCorridaEtapa] = useState<CorridaEtapa>('menu');
  const [numeroParticipantesCorrida, setNumeroParticipantesCorrida] = useState('');
  const [erroParticipantes, setErroParticipantes] = useState('');
  const [nParticipantesConfirmado, setNParticipantesConfirmado] = useState(0);
  const [nipsParticipantes, setNipsParticipantes] = useState<string[]>([]);
  const [nipFeedbackLinhas, setNipFeedbackLinhas] = useState<NipFeedbackLinha[]>([]);
  const [numeroVoltas, setNumeroVoltas] = useState('');
  /** Checklist por [participante][volta] na tabela “Corrida preparada”. */
  const [checksVoltas, setChecksVoltas] = useState<boolean[][]>([]);
  /** Marcar chegada por nadador (natação — sem colunas de volta). */
  const [chegadaNatacao, setChegadaNatacao] = useState<boolean[]>([]);
  /** Tempo (ms) registrado ao marcar a última volta; null = sem tempo ou última volta desmarcada. */
  const [temposMilitaresMs, setTemposMilitaresMs] = useState<(number | null)[]>([]);
  const [salvandoResultadosCorrida, setSalvandoResultadosCorrida] = useState(false);
  const [modalTempoRegistradoVisible, setModalTempoRegistradoVisible] = useState(false);
  const [modalParcialAviso, setModalParcialAviso] = useState<string | null>(null);
  const pendingResultadosNavRef = useRef<ResultadoCorridaItem[] | null>(null);

  const [cronometroEstado, setCronometroEstado] = useState<CronometroCorridaEstado>('inicial');
  const [tempoExibido, setTempoExibido] = useState('00:00');
  const cronometroInicioRef = useRef<number | null>(null);
  /** Ms já decorridos antes do trecho atual (somados a cada pausa). */
  const segmentoAcumuladoMsRef = useRef(0);
  /** Tempo final (ms) após “Parar corrida” — usado ao marcar última volta com corrida parada. */
  const tempoParadoMsRef = useRef<number | null>(null);
  const cronometroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tickCronometroDisplay = useCallback(() => {
    if (cronometroInicioRef.current == null) return;
    const ms = segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    setTempoExibido(formatElapsedMs(ms));
  }, []);

  const getElapsedRaceMs = useCallback((): number | null => {
    if (cronometroEstado === 'rodando' && cronometroInicioRef.current != null) {
      return segmentoAcumuladoMsRef.current + Date.now() - cronometroInicioRef.current;
    }
    if (cronometroEstado === 'pausado') {
      return segmentoAcumuladoMsRef.current;
    }
    if (cronometroEstado === 'finalizado' && tempoParadoMsRef.current != null) {
      return tempoParadoMsRef.current;
    }
    return null;
  }, [cronometroEstado]);

  const resetCronometroCorrida = useCallback(() => {
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    cronometroInicioRef.current = null;
    segmentoAcumuladoMsRef.current = 0;
    tempoParadoMsRef.current = null;
    setCronometroEstado('inicial');
    setTempoExibido('00:00');
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
    setTempoExibido('00:00');
    cronometroIntervalRef.current = setInterval(tickCronometroDisplay, 1000);
  }, [cronometroEstado, tickCronometroDisplay]);

  const pausarCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'rodando' || cronometroInicioRef.current == null) return;
    if (cronometroIntervalRef.current) {
      clearInterval(cronometroIntervalRef.current);
      cronometroIntervalRef.current = null;
    }
    segmentoAcumuladoMsRef.current += Date.now() - cronometroInicioRef.current;
    cronometroInicioRef.current = null;
    setTempoExibido(formatElapsedMs(segmentoAcumuladoMsRef.current));
    setCronometroEstado('pausado');
  }, [cronometroEstado]);

  const continuarCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'pausado') return;
    cronometroInicioRef.current = Date.now();
    setCronometroEstado('rodando');
    tickCronometroDisplay();
    cronometroIntervalRef.current = setInterval(tickCronometroDisplay, 1000);
  }, [cronometroEstado, tickCronometroDisplay]);

  const pararCronometroCorrida = useCallback(() => {
    if (cronometroEstado !== 'rodando' && cronometroEstado !== 'pausado') return;
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
    setTempoExibido(formatElapsedMs(totalMs));
    setCronometroEstado('finalizado');
  }, [cronometroEstado]);

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

  const larguraMinTabela = useMemo(() => {
    const wVolta = 44;
    const wNome = 200;
    const wTempo = 82;
    const wAtleta = 72;
    if (tipoProva === 'natacao') {
      const wMarcar = 128;
      let w = wAtleta + wNome + wMarcar + 24;
      if (mostrarColunaTempo) w += wTempo;
      return w;
    }
    let w = wAtleta + wNome + nColunasVoltas * wVolta + 24;
    if (mostrarColunaTempo) w += wTempo;
    return w;
  }, [tipoProva, nColunasVoltas, mostrarColunaTempo]);

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
    setTempoExibido(formatElapsedMs(totalMs));
    setCronometroEstado('finalizado');
  }, [todosIntegrantesComTempoRegistrado, cronometroEstado]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida' || tipoProva !== 'corrida') return;
    const p = nParticipantesConfirmado;
    const v = nColunasVoltas;
    setChecksVoltas((prev) => {
      const next: boolean[][] = [];
      for (let i = 0; i < p; i += 1) {
        const row: boolean[] = [];
        for (let j = 0; j < v; j += 1) {
          row[j] = prev[i]?.[j] ?? false;
        }
        next[i] = row;
      }
      return next;
    });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado, nColunasVoltas]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida' || tipoProva !== 'natacao') return;
    const p = nParticipantesConfirmado;
    setChegadaNatacao((prev) => {
      const next: boolean[] = [];
      for (let i = 0; i < p; i += 1) {
        next[i] = prev[i] ?? false;
      }
      return next;
    });
  }, [corridaEtapa, tipoProva, nParticipantesConfirmado]);

  useEffect(() => {
    if (corridaEtapa !== 'tabela_corrida') return;
    const p = nParticipantesConfirmado;
    setTemposMilitaresMs((prev) => {
      const next: (number | null)[] = [];
      for (let i = 0; i < p; i += 1) {
        next[i] = prev[i] ?? null;
      }
      return next;
    });
  }, [corridaEtapa, nParticipantesConfirmado]);

  const toggleCheckVolta = useCallback(
    (participante: number, volta: number) => {
      const isLastVolta = nColunasVoltas > 0 && volta === nColunasVoltas - 1;
      setChecksVoltas((prev) => {
        const next = prev.map((row) => [...row]);
        if (!next[participante]) return prev;
        const row = [...next[participante]];
        const willBeChecked = !row[volta];
        row[volta] = willBeChecked;
        next[participante] = row;
        if (isLastVolta) {
          const ms = willBeChecked ? getElapsedRaceMs() : null;
          queueMicrotask(() => {
            setTemposMilitaresMs((prevT) => {
              const nextT = [...prevT];
              while (nextT.length <= participante) nextT.push(null);
              nextT[participante] = ms;
              return nextT;
            });
          });
        }
        return next;
      });
    },
    [nColunasVoltas, getElapsedRaceMs],
  );

  const toggleMarcarChegadaNatacao = useCallback(
    (participante: number) => {
      setChegadaNatacao((prev) => {
        const next = [...prev];
        while (next.length <= participante) next.push(false);
        const willBeChecked = !next[participante];
        next[participante] = willBeChecked;
        const ms = willBeChecked ? getElapsedRaceMs() : null;
        queueMicrotask(() => {
          setTemposMilitaresMs((prevT) => {
            const nextT = [...prevT];
            while (nextT.length <= participante) nextT.push(null);
            nextT[participante] = ms;
            return nextT;
          });
        });
        return next;
      });
    },
    [getElapsedRaceMs],
  );

  const onCadastrarResultados = useCallback(async () => {
    if (salvandoResultadosCorrida) return;
    const prova = tipoProva ?? 'corrida';
    const labelAtleta = prova === 'natacao' ? 'Nadador' : 'Corredor';
    const resultados: ResultadoCorridaItem[] = Array.from({ length: nParticipantesConfirmado }, (_, i) => {
      const fb = nipFeedbackLinhas[i];
      const nomeBase =
        fb?.tipo === 'ok'
          ? (fb.nomeMilitar || '').trim() || `${labelAtleta} ${i + 1}`
          : `${labelAtleta} ${i + 1}`;
      return {
        corredor: i + 1,
        nome: nomeBase,
        tempoMs: temposMilitaresMs[i] ?? 0,
        nip: nipsParticipantes[i] ?? '',
        prova,
      };
    });

    setSalvandoResultadosCorrida(true);
    try {
      const cadastros = await getAllCadastros();
      const listaAtual: CadastroItemPersist[] = [...cadastros];
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
        const tempoStr = formatElapsedMs(r.tempoMs);
        const atualizado: CadastroItemPersist =
          prova === 'natacao'
            ? { ...busca.cadastro, tempoNatacao: tempoStr }
            : { ...busca.cadastro, tempoCorrida: tempoStr };
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
        next[index] = {
          tipo: 'ok',
          texto: 'Militar Cadastrado no Sistema.',
          nomeMilitar: nome,
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
    resetCronometroCorrida();
    setTemposMilitaresMs(Array.from({ length: nParticipantesConfirmado }, () => null));
    if (tipoProva === 'natacao') {
      setChegadaNatacao(Array.from({ length: nParticipantesConfirmado }, () => false));
    }
    setCorridaEtapa('tabela_corrida');
  }, [resetCronometroCorrida, nParticipantesConfirmado, tipoProva]);

  const voltarDeTabelaParaNips = useCallback(() => {
    resetCronometroCorrida();
    setCorridaEtapa('nips');
  }, [resetCronometroCorrida]);

  const iniciarTaf = useCallback(() => {
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
    setChecksVoltas([]);
    setChegadaNatacao([]);
    setTemposMilitaresMs([]);
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
                              ? formatElapsedMs(temposMilitaresMs[index]!)
                              : '—'}
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
