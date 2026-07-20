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
import { PenLine, Pencil, Sparkles, Trash2, X } from 'lucide-react-native';
import { AppModal } from '../premium/AppModal';
import { RubricaCaptureModal } from '../RubricaCaptureModal';
import { ConfirmacaoExcluirResultadoModal } from './ConfirmacaoExcluirResultadoModal';
import {
  DataNascimentoAtencaoModal,
  type DataNascimentoAtencaoInfo,
} from './DataNascimentoAtencaoModal';
import { useTheme } from '../../contexts/ThemeContext';
import { getUiColors } from '../../theme/uiColors';
import {
  tituloTipoProva,
  updateSessaoAplicacao,
  deleteSessaoAplicacao,
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
import {
  limparResultadoModalidadeCadastro,
  type ModalidadeResultadoTaf,
} from '../../utils/limparResultadoModalidade';
import type { TipoProvaTAF } from '../../taf/tafProvaTypes';

function modalidadeExcluivel(tipo: TipoProvaAplicada): ModalidadeResultadoTaf | null {
  if (tipo === 'corrida' || tipo === 'natacao' || tipo === 'permanencia' || tipo === 'caminhada') {
    return tipo;
  }
  return null;
}

function limparResultadoFnNoCadastro(
  cadastro: CadastroItemPersist,
  tipo: TipoProvaAplicada,
): CadastroItemPersist {
  if (tipo === 'flexao_barra') {
    return {
      ...cadastro,
      repsFlexaoBarra: undefined,
      notaFlexaoBarra: undefined,
      dataTafFlexaoBarra: undefined,
    };
  }
  if (tipo === 'flexao_solo') {
    return {
      ...cadastro,
      repsFlexaoSolo: undefined,
      notaFlexaoSolo: undefined,
      dataTafFlexaoSolo: undefined,
    };
  }
  if (tipo === 'abdominal_remador') {
    return {
      ...cadastro,
      repsAbdominalRemador: undefined,
      notaAbdominalRemador: undefined,
      dataTafAbdominalRemador: undefined,
    };
  }
  if (tipo === 'abdominal_prancha') {
    return {
      ...cadastro,
      tempoAbdominalPrancha: undefined,
      notaAbdominalPrancha: undefined,
      dataTafAbdominalPrancha: undefined,
    };
  }
  return cadastro;
}

function reindexDraft(
  draft: Record<number, string>,
  removedIdx: number,
): Record<number, string> {
  const next: Record<number, string> = {};
  Object.entries(draft).forEach(([k, v]) => {
    const i = Number(k);
    if (i === removedIdx) return;
    next[i > removedIdx ? i - 1 : i] = v;
  });
  return next;
}

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

function limparNotaCampos(): Pick<
  ResultadoCorridaItem,
  'notaTexto' | 'noraTexto' | 'reprovacaoTexto'
> {
  return {
    notaTexto: undefined,
    noraTexto: undefined,
    reprovacaoTexto: undefined,
  };
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
      ...limparNotaCampos(),
    };
  }

  const fb = {
    dataNascimento: (meta.dataNascimento || '').trim(),
    sexo: meta.sexo,
  };

  if (tipo === 'permanencia') {
    const low = desempenho.toLowerCase();
    const aprovado = low.startsWith('a');
    const reprovado = low.startsWith('r');
    if (!aprovado && !reprovado) {
      return {
        desempenhoTexto: desempenho,
        tempoMs: 10 * 60 * 1000,
        ...limparNotaCampos(),
      };
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
      return {
        desempenhoTexto: desempenho,
        tempoMs: 0,
        ...limparNotaCampos(),
      };
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
    // Tempo incompleto (ex.: "12") — zera nota até MM:SS válido.
    return {
      desempenhoTexto: desempenho,
      tempoMs: 0,
      ...limparNotaCampos(),
    };
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

function valorDesempenhoExibido(
  tipo: TipoProvaAplicada,
  r: ResultadoCorridaItem,
  draft?: string,
): string {
  if (draft != null) return draft;
  if (tipo === 'permanencia' || provaEhReps(tipo)) {
    return r.desempenhoTexto ?? '';
  }
  return (
    formatMsByModality(
      tipo === 'natacao' || tipo === 'abdominal_prancha' ? 'natacao' : 'corrida',
      r.tempoMs,
    ) || ''
  );
}

function metaFromCadastro(
  cadastros: CadastroItemPersist[],
  nipOuNome: string,
  fallback?: Pick<MetaLinha, 'dataNascimento' | 'sexo'>,
): Pick<MetaLinha, 'dataNascimento' | 'sexo'> {
  const busca = buscarCadastroPorNomeOuNip(cadastros, nipOuNome);
  if (busca.kind === 'found') {
    return {
      dataNascimento: busca.cadastro.dataNascimento || '',
      sexo: busca.cadastro.sexo,
    };
  }
  return {
    dataNascimento: fallback?.dataNascimento ?? '',
    sexo: fallback?.sexo,
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
  const [excluirIdx, setExcluirIdx] = useState<number | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [dnInfo, setDnInfo] = useState<DataNascimentoAtencaoInfo | null>(null);
  const [salvandoDn, setSalvandoDn] = useState(false);

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
      setExcluirIdx(null);
      setDnInfo(null);
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
    setExcluirIdx(null);
    setDnInfo(null);
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

  const solicitarDataNascimento = useCallback(
    (idx: number, cadastro: CadastroItemPersist, nomeFallback?: string) => {
      if ((cadastro.dataNascimento || '').trim()) return;
      setDnInfo({
        linhaIdx: idx,
        nome: (cadastro.nome || nomeFallback || '').trim() || 'Militar',
        nip: (cadastro.nip || '').trim(),
        cadastroId: cadastro.id,
      });
    },
    [],
  );

  const aplicarNipNaLinha = useCallback(
    (idx: number, nipRaw: string) => {
      const nipFmt = formatNipInput(nipRaw);
      setNipDraft((prev) => ({ ...prev, [idx]: nipFmt }));

      const digits = nipDigitos(nipFmt);
      if (digits.length < 8) {
        setLinhas((prev) => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            nip: nipFmt,
            nome: '',
            ...limparNotaCampos(),
            tempoMs: provaEhReps(tipo) || tipo === 'permanencia' ? next[idx].tempoMs : 0,
          };
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
          next[idx] = { ...next[idx], nip: nipFmt, nome: '', ...limparNotaCampos() };
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
        avisoNip: !(c.dataNascimento || '').trim()
          ? 'Cadastro sem data de nascimento — nota indisponível'
          : undefined,
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
        const desemp = valorDesempenhoExibido(tipo, next[idx], desempenhoDraft[idx]).trim();
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

      solicitarDataNascimento(idx, c);
    },
    [cadastros, tipo, desempenhoDraft, modoTafNaval, solicitarDataNascimento],
  );

  // Se o cadastro carregar depois do NIP digitado, resolve e recalcula a nota.
  useEffect(() => {
    if (!cadastros.length) return;
    metas.forEach((meta, idx) => {
      if (!meta?.editavel) return;
      const nip = (nipDraft[idx] ?? linhas[idx]?.nip ?? '').trim();
      if (nipDigitos(nip).length < 8) return;
      // Já resolvido (tem nome) — não reprocessa.
      if ((linhas[idx]?.nome ?? '').trim()) return;
      const busca = buscarCadastroPorNomeOuNip(cadastros, nip);
      if (busca.kind !== 'found') return;
      aplicarNipNaLinha(idx, nip);
    });
    // Intencional: só reage à lista de cadastros (evita loop com metas/linhas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadastros]);

  const aplicarDesempenhoNaLinha = useCallback(
    (idx: number, raw: string) => {
      const valor =
        tipo === 'permanencia' || provaEhReps(tipo)
          ? raw
          : formatMinutosSegundosInput(raw);
      setDesempenhoDraft((prev) => ({ ...prev, [idx]: valor }));

      const nipAtual = (nipDraft[idx] ?? '').trim();
      const precisaDnParaNota =
        tipo === 'permanencia'
          ? false
          : provaEhReps(tipo)
            ? Number.isFinite(parseInt(valor.replace(/\D/g, ''), 10))
            : tempoStringParaMsProva(valor) != null;

      setLinhas((prev) => {
        const next = [...prev];
        const atual = next[idx];
        if (!atual) return prev;
        const nip = (nipDraft[idx] ?? atual.nip ?? '').trim();
        const metaFb = metaFromCadastro(cadastros, nip, metas[idx]);
        const calc = calcularCamposDesempenho(tipo, valor, metaFb, modoTafNaval);
        next[idx] = { ...atual, ...calc, prova: tipo };
        return next;
      });

      setMetas((prev) => {
        const next = [...prev];
        const meta = next[idx];
        if (!meta?.editavel) return prev;
        const nip = (nipDraft[idx] ?? '').trim();
        const metaFb = metaFromCadastro(cadastros, nip, meta);
        const faltaDn = precisaDnParaNota && !(metaFb.dataNascimento || '').trim();
        const avisoAtual = meta.avisoNip;
        const avisoNovo = faltaDn
          ? 'Cadastro sem data de nascimento — nota indisponível'
          : avisoAtual?.includes('data de nascimento')
            ? undefined
            : avisoAtual;
        if (
          metaFb.dataNascimento === meta.dataNascimento &&
          metaFb.sexo === meta.sexo &&
          avisoNovo === avisoAtual
        ) {
          return prev;
        }
        next[idx] = {
          ...meta,
          dataNascimento: metaFb.dataNascimento || meta.dataNascimento,
          sexo: metaFb.sexo ?? meta.sexo,
          avisoNip: avisoNovo,
        };
        return next;
      });

      if (precisaDnParaNota) {
        const busca = buscarCadastroPorNomeOuNip(cadastros, nipAtual);
        if (busca.kind === 'found') {
          solicitarDataNascimento(idx, busca.cadastro);
        }
      }
    },
    [tipo, metas, modoTafNaval, cadastros, nipDraft, solicitarDataNascimento],
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

  /** Recalcula nota/situação com drafts atuais e só então grava (evita blur com estado antigo). */
  const finalizarEdicaoLinha = useCallback(
    (idx: number) => {
      const atual = linhas[idx];
      const meta = metas[idx];
      if (!atual || !meta?.editavel) return;

      const nip = (nipDraft[idx] ?? atual.nip ?? '').trim();
      const valorRaw = valorDesempenhoExibido(tipo, atual, desempenhoDraft[idx]);
      const valor =
        tipo === 'permanencia' || provaEhReps(tipo)
          ? valorRaw
          : formatMinutosSegundosInput(valorRaw);
      const metaFb = metaFromCadastro(cadastros, nip, meta);
      const calc = calcularCamposDesempenho(tipo, valor, metaFb, modoTafNaval);

      const nextLinhas = [...linhas];
      nextLinhas[idx] = {
        ...atual,
        ...calc,
        nip: atual.nip || nip,
        prova: tipo,
      };
      const nextMetas = [...metas];
      nextMetas[idx] = {
        ...meta,
        ...metaFb,
        avisoNip:
          metaFb.dataNascimento?.trim() || !valor.trim()
            ? meta.avisoNip?.includes('não encontrado') || meta.avisoNip?.includes('incompleto')
              ? meta.avisoNip
              : undefined
            : 'Cadastro sem data de nascimento — nota indisponível',
      };

      setLinhas(nextLinhas);
      setMetas(nextMetas);
      if (valor.trim()) {
        setDesempenhoDraft((prev) => ({ ...prev, [idx]: valor }));
      }
      salvarLinhaSePronta(idx, nextLinhas, nextMetas);
    },
    [
      linhas,
      metas,
      nipDraft,
      desempenhoDraft,
      tipo,
      cadastros,
      modoTafNaval,
      salvarLinhaSePronta,
    ],
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

  const habilitarEdicaoLinha = useCallback(
    (idx: number) => {
      const r = linhas[idx];
      if (!r) return;
      const busca = buscarCadastroPorNomeOuNip(cadastros, r.nip || r.nome || '');

      setMetas((prev) => {
        const next = [...prev];
        if (!next[idx]) {
          next[idx] = { editavel: true, dataNascimento: '' };
        } else {
          next[idx] = { ...next[idx], editavel: true };
        }
        if (busca.kind === 'found') {
          next[idx] = {
            ...next[idx],
            editavel: true,
            dataNascimento: busca.cadastro.dataNascimento || '',
            sexo: busca.cadastro.sexo,
            avisoNip: !(busca.cadastro.dataNascimento || '').trim()
              ? 'Cadastro sem data de nascimento — nota indisponível'
              : undefined,
          };
        }
        return next;
      });
      setNipDraft((prev) => ({ ...prev, [idx]: r.nip || '' }));
      setDesempenhoDraft((prev) => ({
        ...prev,
        [idx]: valorDesempenhoExibido(tipo, r, undefined),
      }));

      if (busca.kind === 'found') {
        solicitarDataNascimento(idx, busca.cadastro, r.nome);
      }
    },
    [linhas, cadastros, tipo, solicitarDataNascimento],
  );

  const salvarDataNascimentoInformada = useCallback(
    async (dataNascimento: string) => {
      if (!dnInfo) return;
      const { linhaIdx: idx, cadastroId } = dnInfo;
      const cadastro = cadastros.find((c) => c.id === cadastroId);
      if (!cadastro) {
        setErro('Cadastro do militar não encontrado.');
        setDnInfo(null);
        return;
      }

      setSalvandoDn(true);
      setErro('');
      try {
        const atualizado: CadastroItemPersist = {
          ...cadastro,
          dataNascimento,
          updatedAt: Date.now(),
        };
        await addCadastro(atualizado);
        setCadastros((prev) => prev.map((c) => (c.id === atualizado.id ? atualizado : c)));

        const metaOk: MetaLinha = {
          editavel: true,
          dataNascimento,
          sexo: atualizado.sexo,
          avisoNip: undefined,
        };
        const nextMetas = [...metas];
        if (!nextMetas[idx]) {
          nextMetas[idx] = metaOk;
        } else {
          nextMetas[idx] = { ...nextMetas[idx], ...metaOk, editavel: true };
        }
        setMetas(nextMetas);

        const atual = linhas[idx];
        if (atual) {
          const valorRaw = valorDesempenhoExibido(tipo, atual, desempenhoDraft[idx]);
          const valor =
            tipo === 'permanencia' || provaEhReps(tipo)
              ? valorRaw
              : formatMinutosSegundosInput(valorRaw);
          const calc = valor.trim()
            ? calcularCamposDesempenho(tipo, valor, metaOk, modoTafNaval)
            : {};
          const nextLinhas = [...linhas];
          nextLinhas[idx] = {
            ...atual,
            ...calc,
            nome: (atualizado.nome || atual.nome || '').trim() || '—',
            nip: atualizado.nip || atual.nip,
            prova: tipo,
          };
          setLinhas(nextLinhas);
          if (valor.trim()) {
            setDesempenhoDraft((prev) => ({ ...prev, [idx]: valor }));
            salvarLinhaSePronta(idx, nextLinhas, nextMetas);
          }
        }

        setDnInfo(null);
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível salvar a data de nascimento.');
      } finally {
        setSalvandoDn(false);
      }
    },
    [
      dnInfo,
      cadastros,
      metas,
      linhas,
      desempenhoDraft,
      tipo,
      modoTafNaval,
      salvarLinhaSePronta,
    ],
  );

  const confirmarExclusaoLinha = useCallback(async () => {
    if (excluirIdx == null || !sessao || excluindo) return;
    const idx = excluirIdx;
    const removido = linhas[idx];
    if (!removido) {
      setExcluirIdx(null);
      return;
    }

    setExcluindo(true);
    setErro('');
    try {
      const nextLinhas = renumerar(linhas.filter((_, i) => i !== idx));
      const nextMetas = metas.filter((_, i) => i !== idx);
      setNipDraft((prev) => reindexDraft(prev, idx));
      setDesempenhoDraft((prev) => reindexDraft(prev, idx));

      const nip = (removido.nip || '').trim();
      if (nip) {
        const busca = buscarCadastroPorNomeOuNip(cadastros, nip);
        if (busca.kind === 'found') {
          const modalidade = modalidadeExcluivel(tipo);
          const cadLimpo = modalidade
            ? limparResultadoModalidadeCadastro(busca.cadastro, modalidade)
            : limparResultadoFnNoCadastro(busca.cadastro, tipo);
          await addCadastro(cadLimpo);
          setCadastros((prev) =>
            prev.map((c) => (c.id === cadLimpo.id ? cadLimpo : c)),
          );
        }
      }

      if (nextLinhas.length === 0) {
        await deleteSessaoAplicacao(sessao.id);
        setExcluirIdx(null);
        onSessaoAtualizada?.({ ...sessao, resultados: [] });
        onClose();
        return;
      }

      const atualizada: SessaoAplicacaoTaf = {
        ...sessao,
        resultados: nextLinhas,
        updatedAt: Date.now(),
      };
      await updateSessaoAplicacao(atualizada);
      setLinhas(nextLinhas);
      setMetas(nextMetas);
      setExcluirIdx(null);
      onSessaoAtualizada?.(atualizada);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível excluir a linha.');
    } finally {
      setExcluindo(false);
    }
  }, [
    excluirIdx,
    sessao,
    excluindo,
    linhas,
    metas,
    cadastros,
    tipo,
    onClose,
    onSessaoAtualizada,
  ]);

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
                Use Editar/Excluir na coluna Ações. Clique com o botão direito para inserir uma linha.
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
                  <Text style={[styles.th, styles.colAcoes, { color: theme.textMuted }]}>
                    Ações
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

                      {editavel ? (
                        <View style={[styles.td, styles.colNome]}>
                          <Text style={{ color: ui.text, fontSize: 12, fontWeight: '700' }} numberOfLines={2}>
                            {r.nome?.trim() || '—'}
                          </Text>
                          {meta?.avisoNip ? (
                            <Text
                              style={{ color: theme.loss, fontSize: 10, marginTop: 2, fontWeight: '600' }}
                              numberOfLines={2}
                            >
                              {meta.avisoNip}
                            </Text>
                          ) : null}
                        </View>
                      ) : (
                        <Text style={[styles.td, styles.colNome, { color: ui.text }]} numberOfLines={2}>
                          {r.nome?.trim() || '—'}
                        </Text>
                      )}

                      {editavel ? (
                        <View style={[styles.td, styles.colNip]}>
                          <TextInput
                            value={nipDraft[idx] ?? r.nip ?? ''}
                            onChangeText={(t) => aplicarNipNaLinha(idx, t)}
                            onBlur={() => finalizarEdicaoLinha(idx)}
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
                            value={valorDesempenhoExibido(tipo, r, desempenhoDraft[idx])}
                            onChangeText={(t) => aplicarDesempenhoNaLinha(idx, t)}
                            onBlur={() => finalizarEdicaoLinha(idx)}
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

                      <View style={[styles.td, styles.colAcoes, styles.acoesCell]}>
                        <TouchableOpacity
                          onPress={() => habilitarEdicaoLinha(idx)}
                          style={[
                            styles.acaoBtn,
                            {
                              borderColor: theme.border,
                              backgroundColor: editavel
                                ? theme.isDark
                                  ? 'rgba(56,189,248,0.18)'
                                  : 'rgba(224,242,254,0.95)'
                                : theme.isDark
                                  ? 'rgba(2,6,23,0.35)'
                                  : 'rgba(248,250,252,0.95)',
                            },
                          ]}
                          accessibilityLabel="Editar linha"
                          disabled={salvando || excluindo}
                        >
                          <Pencil
                            size={15}
                            color={editavel ? theme.primary : ui.icon}
                            strokeWidth={2.3}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setExcluirIdx(idx)}
                          style={[
                            styles.acaoBtn,
                            {
                              borderColor: theme.isDark
                                ? 'rgba(248,113,113,0.35)'
                                : 'rgba(220,38,38,0.25)',
                              backgroundColor: theme.isDark
                                ? 'rgba(127,29,29,0.25)'
                                : 'rgba(254,226,226,0.9)',
                            },
                          ]}
                          accessibilityLabel="Excluir linha"
                          disabled={salvando || excluindo}
                        >
                          <Trash2 size={15} color={theme.loss} strokeWidth={2.3} />
                        </TouchableOpacity>
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

      <ConfirmacaoExcluirResultadoModal
        visible={excluirIdx != null}
        nome={(excluirIdx != null ? linhas[excluirIdx]?.nome : '')?.trim() || 'Militar'}
        nip={(excluirIdx != null ? linhas[excluirIdx]?.nip : '')?.trim() || '—'}
        modalidade={modalidadeExcluivel(tipo)}
        rotuloProva={titulo}
        loading={excluindo}
        onClose={() => {
          if (!excluindo) setExcluirIdx(null);
        }}
        onConfirm={() => void confirmarExclusaoLinha()}
      />

      <DataNascimentoAtencaoModal
        info={dnInfo}
        loading={salvandoDn}
        onClose={() => {
          if (!salvandoDn) setDnInfo(null);
        }}
        onSalvar={(data) => void salvarDataNascimentoInformada(data)}
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    ...Platform.select({
      web: {
        minHeight: '100%' as unknown as number,
        maxHeight: '100dvh' as unknown as number,
      } as object,
      default: {},
    }),
  },
  card: {
    width: '100%',
    maxWidth: 960,
    maxHeight: '92%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
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
  colAcoes: { width: 88 },
  rubricaCell: {
    justifyContent: 'center',
    paddingRight: 0,
  },
  acoesCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 0,
  },
  acaoBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
