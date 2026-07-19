import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PenLine, Sparkles, X } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { RubricaCaptureModal } from '../RubricaCaptureModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import {
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../../services/resultadosAplicadosIndexedDb';
import { addCadastro, getAllCadastros, type CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import { formatMsByModality } from '../../taf/tafTimeFormat';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from '../../utils/exportResultadosTafPdf';
import { RubricaCell } from '../RubricaThumb';
import { AplicadorAssinaturaBloco } from '../AplicadorAssinaturaBloco';
import { buscarCadastroPorNomeOuNip } from '../../utils/buscarCadastroPorNomeOuNip';
import { formatNipInput, nipDigitos } from '../../utils/nipFormat';
import { formatMinutosSegundosInput } from '../../utils/formatMinutosSegundos';
import { tempoStringParaMsProva } from '../../utils/calcularIdade';
import {
  calcularNotaLinhaReps,
  calcularNotaLinhaTempo,
  aplicarResultadoNoCadastro,
} from '../../screens/aplicarTafNotaHelpers';
import { persistirRubricasNoCadastro } from '../../utils/persistirRubricaCadastro';
import type { TipoProvaTAF } from '../../taf/tafProvaTypes';

type Props = {
  sessao: SessaoAplicacaoTaf | null;
  onClose: () => void;
  onSessaoAtualizada?: (sessao: SessaoAplicacaoTaf) => void;
};

type MetaLinha = {
  editavel: boolean;
  dataNascimento: string;
  sexo?: 'M' | 'F';
  avisoNip?: string;
};

function desempenhoParticipante(
  tipo: SessaoAplicacaoTaf['tipoProva'],
  r: ResultadoCorridaItem,
): string {
  const texto = r.desempenhoTexto?.trim();
  if (texto) return texto;
  if (tipo === 'permanencia') {
    const n = (r.notaTexto ?? r.desempenhoTexto ?? '').trim();
    if (n) return n;
    return PERMANENCIA_TEMPO_PDF_PADRAO;
  }
  const mod = tipo === 'natacao' || tipo === 'abdominal_prancha' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, r.tempoMs) || '—';
}

function notaParticipante(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function situacaoParticipante(r: ResultadoCorridaItem): { label: string; tone: 'ok' | 'bad' | 'muted' } {
  if (r.reprovacaoTexto?.trim()) return { label: r.reprovacaoTexto.trim(), tone: 'bad' };
  const nota = (r.notaTexto ?? '').trim();
  const upper = nota.toUpperCase();
  if (upper === 'REPROVADO') return { label: 'Reprovado', tone: 'bad' };
  if (nota.toLowerCase() === 'aprovado') return { label: 'Aprovado', tone: 'ok' };
  if (nota.toLowerCase() === 'reprovado') return { label: 'Reprovado', tone: 'bad' };
  if (nota) return { label: 'Aprovado', tone: 'ok' };
  return { label: '—', tone: 'muted' };
}

function provaEhReps(
  tipo: TipoProvaAplicada,
): tipo is 'flexao_barra' | 'flexao_solo' | 'abdominal_remador' {
  return tipo === 'flexao_barra' || tipo === 'flexao_solo' || tipo === 'abdominal_remador';
}

function renumerar(resultados: ResultadoCorridaItem[]): ResultadoCorridaItem[] {
  return resultados.map((r, i) => ({ ...r, corredor: i + 1 }));
}

function calcularCamposDesempenho(
  tipo: TipoProvaAplicada,
  desempenhoRaw: string,
  meta: Pick<MetaLinha, 'dataNascimento' | 'sexo'>,
  modoTafNaval: boolean,
): Partial<ResultadoCorridaItem> {
  const desempenho = desempenhoRaw.trim();
  if (!desempenho) {
    return {
      tempoMs: 0,
      desempenhoTexto: undefined,
      notaTexto: undefined,
      noraTexto: undefined,
      reprovacaoTexto: undefined,
    };
  }

  const fb = { dataNascimento: meta.dataNascimento, sexo: meta.sexo };

  if (tipo === 'permanencia') {
    const low = desempenho.toLowerCase();
    const aprovado = low.startsWith('a');
    const reprovado = low.startsWith('r');
    if (!aprovado && !reprovado) {
      return { desempenhoTexto: desempenho, tempoMs: 10 * 60 * 1000 };
    }
    const notaTexto = aprovado ? 'Aprovado' : 'REPROVADO';
    return {
      tempoMs: 10 * 60 * 1000,
      desempenhoTexto: aprovado ? 'Aprovado' : 'Reprovado',
      notaTexto,
      noraTexto: notaTexto,
      reprovacaoTexto: aprovado ? undefined : 'Reprovado',
      prova: 'permanencia',
    };
  }

  if (provaEhReps(tipo)) {
    const reps = parseInt(desempenho.replace(/\D/g, ''), 10);
    if (!Number.isFinite(reps) || reps < 0) {
      return { desempenhoTexto: desempenho, tempoMs: 0 };
    }
    const notaTexto = calcularNotaLinhaReps(tipo, reps, fb);
    const limpa = notaTexto === '—' ? undefined : notaTexto;
    return {
      tempoMs: 0,
      desempenhoTexto: String(reps),
      notaTexto: limpa,
      noraTexto: limpa,
      reprovacaoTexto: limpa === 'REPROVADO' ? 'Reprovado' : undefined,
      prova: tipo,
    };
  }

  const ms = tempoStringParaMsProva(desempenho);
  if (ms == null) {
    return { desempenhoTexto: desempenho, tempoMs: 0 };
  }
  const notaTexto = calcularNotaLinhaTempo(tipo as TipoProvaTAF, ms, fb, modoTafNaval);
  const limpa = notaTexto === '—' ? undefined : notaTexto;
  return {
    tempoMs: ms,
    desempenhoTexto: undefined,
    notaTexto: limpa,
    noraTexto: limpa,
    reprovacaoTexto: limpa === 'REPROVADO' ? 'Reprovado' : undefined,
    prova: tipo,
  };
}

function placeholderDesempenho(tipo: TipoProvaAplicada): string {
  if (tipo === 'permanencia') return 'Aprovado / Reprovado';
  if (provaEhReps(tipo)) return 'Repetições';
  return 'MM:SS';
}

/** Modal ultramoderno com tabela dos resultados — clique direito insere linha editável. */
export function HistoricoSessaoDetalheModal({ sessao, onClose, onSessaoAtualizada }: Props) {
  const { theme } = useTheme();
  const ui = useMemo(() => getUiColors(theme), [theme]);
  const visible = sessao != null;

  const [linhas, setLinhas] = useState<ResultadoCorridaItem[]>([]);
  const [metas, setMetas] = useState<MetaLinha[]>([]);
  const [nipDraft, setNipDraft] = useState<Record<number, string>>({});
  const [desempenhoDraft, setDesempenhoDraft] = useState<Record<number, string>>({});
  const [cadastros, setCadastros] = useState<CadastroItemPersist[]>([]);
  const [rubricaIdx, setRubricaIdx] = useState<number | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const modoTafNaval = sessao?.normaTaf === 'cfn';
  const tipo = sessao?.tipoProva ?? 'corrida';

  // Reinicia só ao abrir outra sessão (não ao salvar a mesma).
  useEffect(() => {
    if (!sessao) {
      setLinhas([]);
      setMetas([]);
      setNipDraft({});
      setDesempenhoDraft({});
      setRubricaIdx(null);
      setErro('');
      return;
    }
    setLinhas(sessao.resultados.map((r) => ({ ...r })));
    setMetas(
      sessao.resultados.map(() => ({
        editavel: false,
        dataNascimento: '',
      })),
    );
    setNipDraft({});
    setDesempenhoDraft({});
    setRubricaIdx(null);
    setErro('');
    void getAllCadastros()
      .then(setCadastros)
      .catch(() => setCadastros([]));
  }, [sessao?.id]);

  const titulo = sessao ? tituloTipoProva(sessao.tipoProva) : '';
  const colDesempenho =
    tipo === 'permanencia' || provaEhReps(tipo) || linhas.some((r) => r.desempenhoTexto?.trim())
      ? 'Desempenho'
      : 'Tempo';

  const persistirSessao = useCallback(
    async (nextLinhas: ResultadoCorridaItem[], nextMetas: MetaLinha[]) => {
      if (!sessao) return;
      const resultados = renumerar(nextLinhas);
      const atualizada: SessaoAplicacaoTaf = {
        ...sessao,
        resultados,
        updatedAt: Date.now(),
      };
      setSalvando(true);
      setErro('');
      try {
        await updateSessaoAplicacao(atualizada);

        for (let i = 0; i < resultados.length; i++) {
          const r = resultados[i];
          const meta = nextMetas[i];
          if (!meta?.editavel) continue;
          if (!(r.nip ?? '').trim() || !(r.nome ?? '').trim()) continue;
          const busca = buscarCadastroPorNomeOuNip(cadastros, r.nip || r.nome);
          if (busca.kind !== 'found') continue;

          let cad = busca.cadastro;
          if (tipo === 'permanencia') {
            const aprovado = (r.notaTexto ?? '').toLowerCase() === 'aprovado';
            const reprovado = (r.notaTexto ?? '').toUpperCase() === 'REPROVADO';
            if (aprovado || reprovado) {
              cad = {
                ...cad,
                resultadoPermanencia: aprovado ? 'aprovado' : 'reprovado',
                dataTafPermanencia: sessao.dataAplicacao,
                tempoPermanencia: '10:00',
                rubricaPermanenciaSvg: r.rubricaCandidatoSvg ?? cad.rubricaPermanenciaSvg,
              };
            }
          } else if (provaEhReps(tipo)) {
            const reps = parseInt((r.desempenhoTexto ?? '').replace(/\D/g, ''), 10);
            if (Number.isFinite(reps)) {
              cad = aplicarResultadoNoCadastro(cad, tipo, {
                repeticoes: reps,
                modoTafNaval,
              });
            }
          } else if (r.tempoMs > 0) {
            cad = aplicarResultadoNoCadastro(cad, tipo as TipoProvaTAF, {
              tempoMs: r.tempoMs,
              modoTafNaval,
            });
          }
          await addCadastro(cad);
          if (r.rubricaCandidatoSvg?.trim()) {
            await persistirRubricasNoCadastro([{ ...r, prova: r.prova ?? tipo }]);
          }
        }

        setLinhas(resultados);
        onSessaoAtualizada?.(atualizada);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao salvar resultados.');
      } finally {
        setSalvando(false);
      }
    },
    [sessao, cadastros, tipo, modoTafNaval, onSessaoAtualizada],
  );

  const inserirLinhaAbaixo = useCallback((idx: number) => {
    setLinhas((prev) => {
      const vazia: ResultadoCorridaItem = {
        corredor: idx + 2,
        nome: '',
        nip: '',
        tempoMs: 0,
        prova: tipo,
      };
      const next = [...prev.slice(0, idx + 1), vazia, ...prev.slice(idx + 1)];
      return renumerar(next);
    });
    setMetas((prev) => {
      const meta: MetaLinha = { editavel: true, dataNascimento: '' };
      return [...prev.slice(0, idx + 1), meta, ...prev.slice(idx + 1)];
    });
    setNipDraft((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        next[i > idx ? i + 1 : i] = v;
      });
      next[idx + 1] = '';
      return next;
    });
    setDesempenhoDraft((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        next[i > idx ? i + 1 : i] = v;
      });
      next[idx + 1] = '';
      return next;
    });
  }, [tipo]);

  const aplicarNipNaLinha = useCallback(
    (idx: number, nipRaw: string) => {
      const nipFmt = formatNipInput(nipRaw);
      setNipDraft((prev) => ({ ...prev, [idx]: nipFmt }));

      const digits = nipDigitos(nipFmt);
      if (digits.length < 8) {
        setLinhas((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = { ...next[idx], nip: nipFmt, nome: '' };
          return next;
        });
        setMetas((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            dataNascimento: '',
            sexo: undefined,
            avisoNip: digits.length ? 'NIP incompleto' : undefined,
          };
          return next;
        });
        return;
      }

      const busca = buscarCadastroPorNomeOuNip(cadastros, nipFmt);
      if (busca.kind !== 'found') {
        setLinhas((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = { ...next[idx], nip: nipFmt, nome: '' };
          return next;
        });
        setMetas((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            dataNascimento: '',
            sexo: undefined,
            avisoNip: 'Militar não encontrado',
          };
          return next;
        });
        return;
      }

      const c = busca.cadastro;
      const metaOk: MetaLinha = {
        editavel: true,
        dataNascimento: c.dataNascimento || '',
        sexo: c.sexo,
        avisoNip: undefined,
      };
      setMetas((prev) => {
        const next = [...prev];
        if (!next[idx]) return prev;
        next[idx] = { ...next[idx], ...metaOk, editavel: next[idx].editavel };
        return next;
      });
      setNipDraft((prev) => ({ ...prev, [idx]: c.nip || nipFmt }));

      setLinhas((prev) => {
        const next = [...prev];
        if (!next[idx]) return prev;
        const desemp = (desempenhoDraft[idx] ?? '').trim();
        const calc = desemp
          ? calcularCamposDesempenho(tipo, desemp, metaOk, modoTafNaval)
          : {};
        next[idx] = {
          ...next[idx],
          ...calc,
          nip: c.nip || nipFmt,
          nome: (c.nome || '').trim() || '—',
          prova: tipo,
        };
        return next;
      });
    },
    [cadastros, tipo, desempenhoDraft, modoTafNaval],
  );

  const aplicarDesempenhoNaLinha = useCallback(
    (idx: number, raw: string) => {
      const valor =
        tipo === 'permanencia' || provaEhReps(tipo)
          ? raw
          : formatMinutosSegundosInput(raw);
      setDesempenhoDraft((prev) => ({ ...prev, [idx]: valor }));

      setLinhas((prev) => {
        const next = [...prev];
        const atual = next[idx];
        if (!atual) return prev;
        const busca = buscarCadastroPorNomeOuNip(cadastros, atual.nip || '');
        const metaFb =
          busca.kind === 'found'
            ? {
                dataNascimento: busca.cadastro.dataNascimento || '',
                sexo: busca.cadastro.sexo,
              }
            : {
                dataNascimento: metas[idx]?.dataNascimento ?? '',
                sexo: metas[idx]?.sexo,
              };
        const calc = calcularCamposDesempenho(tipo, valor, metaFb, modoTafNaval);
        next[idx] = { ...atual, ...calc, prova: tipo };
        return next;
      });
    },
    [tipo, metas, modoTafNaval, cadastros],
  );

  const salvarLinhaSePronta = useCallback(
    (idx: number, linhasNow?: ResultadoCorridaItem[], metasNow?: MetaLinha[]) => {
      const L = linhasNow ?? linhas;
      const M = metasNow ?? metas;
      const r = L[idx];
      const meta = M[idx];
      if (!r || !meta?.editavel) return;
      if (!(r.nip ?? '').trim() || !(r.nome ?? '').trim()) return;
      const temDesempenho =
        tipo === 'permanencia'
          ? Boolean(r.notaTexto?.trim())
          : provaEhReps(tipo)
            ? Boolean(r.desempenhoTexto?.trim())
            : r.tempoMs > 0;
      if (!temDesempenho) return;
      void persistirSessao(L, M);
    },
    [linhas, metas, tipo, persistirSessao],
  );

  const confirmarRubrica = useCallback(
    (svg: string) => {
      if (rubricaIdx == null) return;
      const idx = rubricaIdx;
      setLinhas((prev) => {
        const next = [...prev];
        if (!next[idx]) return prev;
        next[idx] = {
          ...next[idx],
          rubricaCandidatoSvg: svg,
          rubricaCandidato: 'Rúbrica capturada',
        };
        void persistirSessao(next, metas);
        return next;
      });
      setRubricaIdx(null);
    },
    [rubricaIdx, metas, persistirSessao],
  );

  const onContextMenuLinha = useCallback(
    (idx: number, e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      inserirLinhaAbaixo(idx);
    },
    [inserirLinhaAbaixo],
  );

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(2,6,23,0.72)', 'rgba(15,23,42,0.88)']}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.isDark ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)',
              borderColor: theme.isDark ? 'rgba(56,189,248,0.35)' : 'rgba(37,99,235,0.22)',
              ...(Platform.OS === 'web'
                ? ({ boxShadow: '0 28px 70px rgba(2,6,23,0.45)' } as object)
                : null),
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(37,99,235,0.22)', 'rgba(56,189,248,0.06)', 'transparent']}
            style={styles.glow}
          />

          <View style={styles.header}>
            <View style={styles.headerText}>
              <View style={styles.kickerRow}>
                <Sparkles size={12} color="#38bdf8" strokeWidth={2.4} />
                <Text style={styles.kicker}>HISTÓRICO</Text>
              </View>
              <Text style={[styles.title, { color: ui.text }]} numberOfLines={2}>
                {titulo}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {sessao?.dataAplicacao ?? '—'}
                {` · ${linhas.length} participante${linhas.length !== 1 ? 's' : ''}`}
                {salvando ? ' · Salvando…' : ''}
              </Text>
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Clique com o botão direito em uma linha para inserir um resultado manual abaixo.
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.closeBtn,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.isDark ? 'rgba(2,6,23,0.45)' : 'rgba(248,250,252,0.9)',
                },
              ]}
            >
              <X size={18} color={theme.textSecondary} strokeWidth={2.4} />
            </TouchableOpacity>
          </View>

          {erro ? (
            <Text style={[styles.erro, { color: theme.loss }]}>{erro}</Text>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
          >
            <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
              <View style={styles.table}>
                <View
                  style={[
                    styles.tr,
                    styles.thead,
                    {
                      borderBottomColor: theme.isDark
                        ? 'rgba(56,189,248,0.28)'
                        : 'rgba(37,99,235,0.18)',
                      backgroundColor: theme.isDark
                        ? 'rgba(14,165,233,0.1)'
                        : 'rgba(37,99,235,0.06)',
                    },
                  ]}
                >
                  <Text style={[styles.th, styles.colNum, { color: theme.textMuted }]}>#</Text>
                  <Text style={[styles.th, styles.colNome, { color: theme.textMuted }]}>Nome</Text>
                  <Text style={[styles.th, styles.colNip, { color: theme.textMuted }]}>NIP</Text>
                  <Text style={[styles.th, styles.colTempo, { color: theme.textMuted }]}>
                    {colDesempenho}
                  </Text>
                  <Text style={[styles.th, styles.colNota, { color: theme.textMuted }]}>Nota</Text>
                  <Text style={[styles.th, styles.colSit, { color: theme.textMuted }]}>Situação</Text>
                  <Text style={[styles.th, styles.colRubrica, { color: theme.textMuted }]}>
                    Rúbrica
                  </Text>
                </View>

                {linhas.map((r, idx) => {
                  const sit = situacaoParticipante(r);
                  const sitColor =
                    sit.tone === 'ok'
                      ? theme.gain
                      : sit.tone === 'bad'
                        ? theme.loss
                        : theme.textMuted;
                  const meta = metas[idx];
                  const editavel = Boolean(meta?.editavel);
                  const rowBg =
                    idx % 2 === 0
                      ? 'transparent'
                      : theme.isDark
                        ? 'rgba(2,6,23,0.35)'
                        : 'rgba(248,250,252,0.85)';

                  return (
                    <Pressable
                      key={`${sessao?.id}-row-${idx}-${r.corredor}`}
                      onLongPress={() => inserirLinhaAbaixo(idx)}
                      delayLongPress={450}
                      {...(Platform.OS === 'web'
                        ? ({
                            onContextMenu: (e: { preventDefault: () => void }) =>
                              onContextMenuLinha(idx, e),
                          } as object)
                        : {})}
                      style={[
                        styles.tr,
                        {
                          borderBottomColor: theme.isDark
                            ? 'rgba(148,163,184,0.12)'
                            : 'rgba(148,163,184,0.2)',
                          backgroundColor: editavel
                            ? theme.isDark
                              ? 'rgba(56,189,248,0.08)'
                              : 'rgba(224,242,254,0.65)'
                            : rowBg,
                        },
                      ]}
                    >
                      <Text style={[styles.td, styles.colNum, { color: theme.textMuted }]}>
                        {r.corredor || idx + 1}
                      </Text>

                      <Text
                        style={[styles.td, styles.colNome, { color: ui.text }]}
                        numberOfLines={2}
                      >
                        {editavel
                          ? r.nome?.trim() || meta?.avisoNip || '—'
                          : r.nome?.trim() || '—'}
                      </Text>

                      {editavel ? (
                        <View style={[styles.td, styles.colNip]}>
                          <TextInput
                            value={nipDraft[idx] ?? r.nip ?? ''}
                            onChangeText={(t) => aplicarNipNaLinha(idx, t)}
                            onBlur={() => salvarLinhaSePronta(idx)}
                            placeholder="NIP"
                            placeholderTextColor={theme.textMuted}
                            keyboardType={Platform.OS === 'web' ? 'default' : 'number-pad'}
                            style={[
                              styles.cellInput,
                              {
                                color: ui.text,
                                borderColor: theme.border,
                                backgroundColor: theme.isDark
                                  ? 'rgba(2,6,23,0.45)'
                                  : '#FFFFFF',
                              },
                            ]}
                          />
                        </View>
                      ) : (
                        <Text style={[styles.td, styles.colNip, { color: ui.text }]} numberOfLines={1}>
                          {r.nip?.trim() || '—'}
                        </Text>
                      )}

                      {editavel ? (
                        <View style={[styles.td, styles.colTempo]}>
                          <TextInput
                            value={
                              desempenhoDraft[idx] ??
                              (tipo === 'permanencia' || provaEhReps(tipo)
                                ? r.desempenhoTexto ?? ''
                                : formatMsByModality(
                                    tipo === 'natacao' || tipo === 'abdominal_prancha'
                                      ? 'natacao'
                                      : 'corrida',
                                    r.tempoMs,
                                  ) || '')
                            }
                            onChangeText={(t) => aplicarDesempenhoNaLinha(idx, t)}
                            onBlur={() => salvarLinhaSePronta(idx)}
                            placeholder={placeholderDesempenho(tipo)}
                            placeholderTextColor={theme.textMuted}
                            keyboardType={
                              Platform.OS === 'web'
                                ? 'default'
                                : provaEhReps(tipo)
                                  ? 'number-pad'
                                  : 'numbers-and-punctuation'
                            }
                            style={[
                              styles.cellInput,
                              {
                                color: ui.text,
                                borderColor: theme.border,
                                backgroundColor: theme.isDark
                                  ? 'rgba(2,6,23,0.45)'
                                  : '#FFFFFF',
                              },
                            ]}
                          />
                        </View>
                      ) : (
                        <Text
                          style={[styles.td, styles.colTempo, { color: ui.text }]}
                          numberOfLines={1}
                        >
                          {desempenhoParticipante(tipo, r)}
                        </Text>
                      )}

                      <Text style={[styles.td, styles.colNota, { color: ui.text }]} numberOfLines={1}>
                        {notaParticipante(r)}
                      </Text>
                      <Text
                        style={[styles.td, styles.colSit, { color: sitColor, fontWeight: '800' }]}
                        numberOfLines={2}
                      >
                        {sit.label}
                      </Text>

                      <View style={[styles.td, styles.colRubrica, styles.rubricaCell]}>
                        {editavel && !r.rubricaCandidatoSvg?.trim() ? (
                          <TouchableOpacity
                            onPress={() => setRubricaIdx(idx)}
                            style={[
                              styles.rubricaVaziaBtn,
                              {
                                borderColor: theme.border,
                                backgroundColor: theme.isDark
                                  ? 'rgba(2,6,23,0.35)'
                                  : 'rgba(248,250,252,0.95)',
                              },
                            ]}
                            accessibilityLabel="Adicionar rúbrica"
                          >
                            <PenLine size={14} color={theme.primary} strokeWidth={2.4} />
                            <Text style={[styles.rubricaVaziaText, { color: theme.primary }]}>
                              Assinar
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            disabled={!editavel}
                            onPress={() => (editavel ? setRubricaIdx(idx) : undefined)}
                          >
                            <RubricaCell
                              svgUri={r.rubricaCandidatoSvg}
                              maxWidth={110}
                              maxHeight={44}
                            />
                          </TouchableOpacity>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {sessao?.aplicadorAssinatura ? (
              <View style={styles.aplicadorWrap}>
                <Text style={[styles.aplicadorLabel, { color: theme.textMuted }]}>
                  ASSINATURA DO APLICADOR
                </Text>
                <AplicadorAssinaturaBloco assinatura={sessao.aplicadorAssinatura} />
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>

      <RubricaCaptureModal
        visible={rubricaIdx != null}
        participante={rubricaIdx != null ? linhas[rubricaIdx] ?? null : null}
        indice={rubricaIdx ?? 0}
        total={linhas.length}
        tipoProva={tipo}
        ultimo
        confirmLabel="Salvar rúbrica"
        onConfirm={confirmarRubrica}
        onSkip={() => setRubricaIdx(null)}
        onCancel={() => setRubricaIdx(null)}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 960,
    maxHeight: '92%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    color: '#38bdf8',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
  },
  erro: {
    marginHorizontal: 20,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  table: {
    minWidth: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    minHeight: 52,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  thead: {
    minHeight: 42,
  },
  th: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  td: {
    fontSize: 13,
    fontWeight: '700',
    paddingRight: 8,
  },
  colNum: { width: 36 },
  colNome: { width: 170 },
  colNip: { width: 110 },
  colTempo: { width: 110 },
  colNota: { width: 72 },
  colSit: { width: 96 },
  colRubrica: { width: 120 },
  rubricaCell: {
    justifyContent: 'center',
    paddingRight: 0,
  },
  cellInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'web' ? 6 : 8,
    fontSize: 13,
    fontWeight: '700',
    minWidth: 88,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  rubricaVaziaBtn: {
    minWidth: 100,
    minHeight: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  rubricaVaziaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  aplicadorWrap: {
    marginTop: 18,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.25)',
  },
  aplicadorLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
});
