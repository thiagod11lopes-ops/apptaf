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

/**
 * Busca registro da modalidade apenas no Histórico (mesma fonte da aba Resultado Geral).
 * Dados legados só no cadastro (ex.: Registrador de TAF) não disparam "teste já aplicado".
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

  const listaCadastros = cadastros.length > 0 ? cadastros : [cadastro];

  const doTipo = sessoes
    .filter((s) => s.tipoProva === tipo)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));

  for (const sessao of doTipo) {
    for (const r of sessao.resultados) {
      const matchNip = alvoNip && nipDigitos(r.nip) === alvoNip;
      const matchCadastro = resultadoPertenceAoCadastro(r, cadastro, listaCadastros);
      if (matchNip || matchCadastro) {
        return registroFromHistorico(sessao, r);
      }
    }
  }

  return null;
}

/** Remove o participante de todas as sessões da modalidade no histórico. */
export async function removerParticipanteModalidadeDoHistorico(
  nip: string,
  tipo: TipoProvaAplicada,
): Promise<void> {
  const alvo = nipDigitos(nip);
  if (!alvo) return;

  const sessoes = await getAllSessoesAplicacao();
  for (const sessao of sessoes) {
    if (sessao.tipoProva !== tipo) continue;
    const filtrados = sessao.resultados.filter((r) => nipDigitos(r.nip) !== alvo);
    if (filtrados.length === sessao.resultados.length) continue;
    if (filtrados.length === 0) {
      await deleteSessaoAplicacao(sessao.id);
    } else {
      await updateSessaoAplicacao({ ...sessao, resultados: filtrados });
    }
  }
}
