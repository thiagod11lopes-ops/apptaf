import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { formatNipInput, nipDigitos } from './nipFormat';
import type { PendenciaParcialItem, ResultadoGeralItem } from './resultadoTafCadastro';

type ModalidadeHistorico = {
  nota: string;
  situacao: string;
  tempo?: string;
  rubricaSvg?: string;
};

type AggRow = {
  id: string;
  nip: string;
  nome: string;
  corrida?: ModalidadeHistorico;
  natacao?: ModalidadeHistorico;
  permanencia?: ModalidadeHistorico;
};

function chaveParticipanteAnon(nip: string, nome: string): string {
  const d = nipDigitos(nip);
  if (d.length >= 8) return `nip:${d}`;
  const n = nome.trim().toLowerCase();
  if (n.length >= 2) return `nome:${n}`;
  return '';
}

function idParticipante(
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
): string {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') return busca.cadastro.id;
  return chaveParticipanteAnon(r.nip ?? '', r.nome ?? '');
}

function situacaoFromResultado(r: ResultadoCorridaItem): string {
  const rep = (r.reprovacaoTexto ?? '').trim();
  if (rep) return rep;
  const nota = (r.notaTexto ?? r.noraTexto ?? '').trim();
  if (nota.toUpperCase() === 'REPROVADO') return 'Reprovado';
  if (nota) return 'Aprovado';
  return '—';
}

function notaFromResultado(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function tempoPermanenciaFromResultado(r: ResultadoCorridaItem): string {
  if (r.tempoMs > 0 && r.tempoMs < 10 * 60 * 1000) {
    return formatMsByModality('corrida', r.tempoMs) || PERMANENCIA_TEMPO_PDF_PADRAO;
  }
  return PERMANENCIA_TEMPO_PDF_PADRAO;
}

function sliceFromResultado(
  tipo: TipoProvaAplicada,
  r: ResultadoCorridaItem,
): ModalidadeHistorico {
  if (tipo === 'permanencia') {
    return {
      nota: '—',
      situacao: situacaoFromResultado(r),
      tempo: tempoPermanenciaFromResultado(r),
      rubricaSvg: r.rubricaCandidatoSvg,
    };
  }
  return {
    nota: notaFromResultado(r),
    situacao: situacaoFromResultado(r),
    rubricaSvg: r.rubricaCandidatoSvg,
  };
}

function atualizarIdentidade(agg: AggRow, r: ResultadoCorridaItem, cadastros: CadastroItemPersist[]) {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') {
    agg.nip = formatNipInput(busca.cadastro.nip ?? '') || agg.nip;
    agg.nome = (busca.cadastro.nome ?? '').trim() || agg.nome;
    return;
  }
  const nipFmt = formatNipInput(r.nip ?? '');
  if (nipFmt.trim()) agg.nip = nipFmt;
  const nome = (r.nome ?? '').trim();
  if (nome) agg.nome = nome;
}

function aggParaLinha(agg: AggRow): ResultadoGeralItem {
  const temCorrida = !!agg.corrida;
  const temNatacao = !!agg.natacao;
  const temPerm = !!agg.permanencia;

  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    notaCorrida: temCorrida ? agg.corrida!.nota : '—',
    situacaoCorrida: temCorrida ? agg.corrida!.situacao : '—',
    notaNatacao: temNatacao ? agg.natacao!.nota : '—',
    situacaoNatacao: temNatacao ? agg.natacao!.situacao : '—',
    permanenciaTempo: temPerm ? (agg.permanencia!.tempo ?? '—') : '—',
    situacaoPermanencia: temPerm ? agg.permanencia!.situacao : '—',
    rubricaCorridaSvg: agg.corrida?.rubricaSvg,
    rubricaNatacaoSvg: agg.natacao?.rubricaSvg,
    rubricaPermanenciaSvg: agg.permanencia?.rubricaSvg,
    statusTaf:
      temCorrida && temNatacao && temPerm ? ('Completo' as const) : ('Parcial' as const),
  };
}

/** Agrega participantes e modalidades a partir das sessões do Histórico (sessão mais recente prevalece). */
export function agregarHistoricoPorParticipante(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): AggRow[] {
  const map = new Map<string, AggRow>();
  const ordenadas = [...sessoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  for (const sessao of ordenadas) {
    const tipo = sessao.tipoProva;
    for (const r of sessao.resultados) {
      const id = idParticipante(r, cadastros);
      if (!id) continue;

      let agg = map.get(id);
      if (!agg) {
        const busca = buscarCadastroPorNomeOuNip(
          cadastros,
          (r.nip ?? '').trim() || (r.nome ?? '').trim(),
        );
        agg = {
          id: busca.kind === 'found' ? busca.cadastro.id : id,
          nip:
            busca.kind === 'found'
              ? formatNipInput(busca.cadastro.nip ?? '') || '—'
              : formatNipInput(r.nip ?? '') || '—',
          nome:
            busca.kind === 'found'
              ? (busca.cadastro.nome ?? '').trim() || '—'
              : (r.nome ?? '').trim() || '—',
        };
        map.set(id, agg);
      }

      atualizarIdentidade(agg, r, cadastros);
      const slice = sliceFromResultado(tipo, r);

      if (tipo === 'corrida') agg.corrida = slice;
      else if (tipo === 'natacao') agg.natacao = slice;
      else if (tipo === 'permanencia') agg.permanencia = slice;
    }
  }

  return [...map.values()].filter((agg) => agg.corrida || agg.natacao || agg.permanencia);
}

function aggParaPendenciaParcial(agg: AggRow): PendenciaParcialItem | null {
  const temCorrida = !!agg.corrida;
  const temNatacao = !!agg.natacao;
  const temPermanencia = !!agg.permanencia;
  const alguma = temCorrida || temNatacao || temPermanencia;
  const completo = temCorrida && temNatacao && temPermanencia;
  if (!alguma || completo) return null;

  const faltam: string[] = [];
  if (!temCorrida) faltam.push('Corrida');
  if (!temNatacao) faltam.push('Natação');
  if (!temPermanencia) faltam.push('Permanência');

  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    temCorrida,
    temNatacao,
    temPermanencia,
    faltam,
  };
}

/**
 * Monta o Resultado Geral exclusivamente a partir das sessões do Histórico.
 * Modalidades ausentes no histórico aparecem como "—" na tabela.
 */
export function listarResultadosGeralFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ResultadoGeralItem[] {
  return agregarHistoricoPorParticipante(sessoes, cadastros)
    .map(aggParaLinha)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/**
 * Militares com ao menos uma modalidade no Histórico, mas sem as três.
 */
export function listarPendenciasParciaisFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): PendenciaParcialItem[] {
  return agregarHistoricoPorParticipante(sessoes, cadastros)
    .map(aggParaPendenciaParcial)
    .filter((item): item is PendenciaParcialItem => item != null)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type ResumoInicioTafHistorico = {
  totalCadastrados: number;
  /** Três modalidades no Histórico. */
  completos: number;
  /** Ao menos uma modalidade no Histórico, sem as três. */
  parcial: number;
  /** Cadastrados sem nenhuma sessão no Histórico. */
  semTeste: number;
};

function cadastroNoHistorico(c: CadastroItemPersist, aggs: AggRow[]): boolean {
  const nipC = nipDigitos(c.nip);
  return aggs.some((agg) => {
    if (agg.id === c.id) return true;
    const nipA = nipDigitos(agg.nip);
    return nipC.length >= 8 && nipA.length >= 8 && nipC === nipA;
  });
}

/** Resumo da aba Iniciar com base no Histórico de aplicações. */
export function calcularResumoInicioTafFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): ResumoInicioTafHistorico {
  const aggs = agregarHistoricoPorParticipante(sessoes, cadastros);

  let completos = 0;
  let parcial = 0;
  for (const agg of aggs) {
    const temCorrida = !!agg.corrida;
    const temNatacao = !!agg.natacao;
    const temPerm = !!agg.permanencia;
    if (temCorrida && temNatacao && temPerm) completos += 1;
    else if (temCorrida || temNatacao || temPerm) parcial += 1;
  }

  const semTeste = cadastros.filter((c) => !cadastroNoHistorico(c, aggs)).length;

  return {
    totalCadastrados: cadastros.length,
    completos,
    parcial,
    semTeste,
  };
}
