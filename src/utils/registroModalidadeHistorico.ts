import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  deleteSessaoAplicacao,
  getAllSessoesAplicacao,
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import { formatMsByModality } from '../taf/tafTimeFormat';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { nipDigitos } from './nipFormat';
import { getSessaoSortTime } from '../services/offline/recordTimestamps';
import {
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { SESSAO_REGISTRADOR_ID_PREFIX } from './sessoesUnificadasResultados';

export type RegistroModalidadeExistente = {
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  modalidadeLabel: string;
};

function situacaoFromResultado(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto?.trim()) return r.reprovacaoTexto.trim();
  const nota = (r.notaTexto ?? r.noraTexto ?? '').trim();
  if (nota.toUpperCase() === 'REPROVADO') return 'Reprovado';
  if (nota.toLowerCase() === 'aprovado') return 'Aprovado';
  if (nota) return 'Aprovado';
  return '—';
}

function tempoFromResultado(tipo: TipoProvaAplicada, r: ResultadoCorridaItem): string {
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  const mod = tipo === 'natacao' ? 'natacao' : 'corrida';
  return formatMsByModality(mod, r.tempoMs) || '—';
}

function notaFromResultado(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function registroFromHistorico(
  sessao: SessaoAplicacaoTaf,
  r: ResultadoCorridaItem,
): RegistroModalidadeExistente {
  const tipo = sessao.tipoProva;
  return {
    dataAplicacao: sessao.dataAplicacao,
    tempo: tempoFromResultado(tipo, r),
    nota: notaFromResultado(r),
    situacao: situacaoFromResultado(r),
    modalidadeLabel: tituloTipoProva(tipo),
  };
}

function resultadoPertenceAoCadastro(
  r: ResultadoCorridaItem,
  cadastro: CadastroItemPersist,
  cadastros: CadastroItemPersist[],
): boolean {
  const alvoNip = nipDigitos(cadastro.nip);
  const nipResultado = nipDigitos(r.nip);
  if (alvoNip && nipResultado && alvoNip === nipResultado) return true;

  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  return busca.kind === 'found' && busca.cadastro.id === cadastro.id;
}

function cadastroTemResultadoNaModalidade(
  c: CadastroItemPersist,
  tipo: TipoProvaAplicada,
): boolean {
  switch (tipo) {
    case 'corrida':
      return temAvaliacaoCorrida(c);
    case 'natacao':
      return temAvaliacaoNatacao(c);
    case 'permanencia':
      return temAvaliacaoPermanencia(c);
    default:
      return false;
  }
}

function resultadoDeveSerRemovido(
  r: ResultadoCorridaItem,
  alvoNip: string,
  cadastro: CadastroItemPersist | undefined,
  cadastros: CadastroItemPersist[],
): boolean {
  if (alvoNip && nipDigitos(r.nip) === alvoNip) return true;
  if (cadastro && resultadoPertenceAoCadastro(r, cadastro, cadastros)) return true;
  return false;
}

/**
 * Busca registro da modalidade no Histórico somente se o cadastro ainda tiver resultado.
 * Sessões órfãs (após exclusão do cadastro) não bloqueiam novo teste.
 */
export function buscarRegistroModalidadeExistente(
  nip: string,
  tipo: TipoProvaAplicada,
  sessoes: SessaoAplicacaoTaf[],
  cadastro: CadastroItemPersist,
  cadastros: CadastroItemPersist[] = [],
): RegistroModalidadeExistente | null {
  const alvoNip = nipDigitos(nip);
  if (!alvoNip && !cadastro.id) return null;
  if (!cadastroTemResultadoNaModalidade(cadastro, tipo)) return null;

  const listaCadastros = cadastros.length > 0 ? cadastros : [cadastro];

  let melhor: { sessao: SessaoAplicacaoTaf; resultado: ResultadoCorridaItem; sortTime: number } | null =
    null;

  for (const sessao of sessoes) {
    if (sessao.tipoProva !== tipo) continue;
    const sortTime = getSessaoSortTime(sessao);
    for (const r of sessao.resultados) {
      const matchNip = alvoNip && nipDigitos(r.nip) === alvoNip;
      const matchCadastro = resultadoPertenceAoCadastro(r, cadastro, listaCadastros);
      if (!matchNip && !matchCadastro) continue;
      if (!melhor || sortTime >= melhor.sortTime) {
        melhor = { sessao, resultado: r, sortTime };
      }
    }
  }

  return melhor ? registroFromHistorico(melhor.sessao, melhor.resultado) : null;
}

/** Remove sessões do Registrador vinculadas ao cadastro (id determinístico). */
export async function removerSessoesRegistradorPorCadastro(
  cadastroId: string,
  tipo?: TipoProvaAplicada,
): Promise<void> {
  const tipos: TipoProvaAplicada[] = tipo
    ? [tipo]
    : ['corrida', 'natacao', 'permanencia'];
  const sessoes = await getAllSessoesAplicacao();
  for (const t of tipos) {
    const id = `${SESSAO_REGISTRADOR_ID_PREFIX}${cadastroId}-${t}`;
    if (sessoes.some((s) => s.id === id)) {
      await deleteSessaoAplicacao(id);
    }
  }
}

/** Remove o participante de todas as sessões da modalidade no histórico. */
export async function removerParticipanteModalidadeDoHistorico(
  nip: string,
  tipo: TipoProvaAplicada,
  cadastro?: CadastroItemPersist,
): Promise<void> {
  const alvo = nipDigitos(nip);
  if (!alvo && !cadastro) return;

  if (cadastro?.id) {
    await removerSessoesRegistradorPorCadastro(cadastro.id, tipo);
  }

  const listaCadastros = cadastro ? [cadastro] : [];
  const sessoes = await getAllSessoesAplicacao();
  for (const sessao of sessoes) {
    if (sessao.tipoProva !== tipo) continue;
    const filtrados = sessao.resultados.filter(
      (r) => !resultadoDeveSerRemovido(r, alvo, cadastro, listaCadastros),
    );
    if (filtrados.length === sessao.resultados.length) continue;
    if (filtrados.length === 0) {
      await deleteSessaoAplicacao(sessao.id);
    } else {
      await updateSessaoAplicacao({ ...sessao, resultados: filtrados });
    }
  }
}
