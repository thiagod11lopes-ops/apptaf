import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { nipDigitos } from './nipFormat';
import type { PendenciaParcialItem } from './resultadoTafCadastro';
import { temAvaliacaoCorridaOuCaminhada } from './resultadoTafCadastro';
import { agregarHistoricoPorParticipante } from './resultadoGeralHistorico';
import { unificarSessoesComCadastroRegistrador } from './sessoesUnificadasResultados';

export type FiltroPendenciaTaf = 'total' | 'corrida' | 'natacao' | 'permanencia';

export type PendenciaTafItem = PendenciaParcialItem & {
  postoGrad: string;
  categoria: string;
  situacao: 'Sem teste' | 'Parcial';
};

export type ContagemPendenciasTaf = Record<FiltroPendenciaTaf, number>;

export const FILTRO_PENDENCIA_LABEL: Record<FiltroPendenciaTaf, string> = {
  total: 'Pendência Total',
  corrida: 'Pendência Corrida',
  natacao: 'Pendência Natação',
  permanencia: 'Pendência Permanência',
};

function aggPorCadastro(
  cadastros: CadastroItemPersist[],
  aggs: ReturnType<typeof agregarHistoricoPorParticipante>,
): Map<string, (typeof aggs)[number]> {
  const porId = new Map<string, (typeof aggs)[number]>();
  for (const agg of aggs) {
    porId.set(agg.id, agg);
  }
  for (const agg of aggs) {
    const nipA = nipDigitos(agg.nip);
    if (nipA.length < 8) continue;
    for (const c of cadastros) {
      if (nipDigitos(c.nip) === nipA) {
        porId.set(c.id, agg);
      }
    }
  }
  return porId;
}

function itemFromAgg(
  agg: ReturnType<typeof agregarHistoricoPorParticipante>[number],
): PendenciaTafItem | null {
  const temCorrida = !!agg.corrida || !!agg.caminhada;
  const temNatacao = !!agg.natacao;
  const temPermanencia = !!agg.permanencia;
  if (temCorrida && temNatacao && temPermanencia) return null;

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
    postoGrad: '—',
    categoria: '—',
    situacao: 'Parcial',
  };
}

function itemFromCadastro(
  c: CadastroItemPersist,
  agg: ReturnType<typeof agregarHistoricoPorParticipante>[number] | undefined,
): PendenciaTafItem | null {
  const temCorrida =
    !!agg?.corrida || !!agg?.caminhada || temAvaliacaoCorridaOuCaminhada(c);
  const temNatacao = !!agg?.natacao;
  const temPermanencia = !!agg?.permanencia;
  if (temCorrida && temNatacao && temPermanencia) return null;

  const faltam: string[] = [];
  if (!temCorrida) faltam.push('Corrida');
  if (!temNatacao) faltam.push('Natação');
  if (!temPermanencia) faltam.push('Permanência');

  const alguma = temCorrida || temNatacao || temPermanencia;

  return {
    id: c.id,
    nip: c.nip?.trim() || '—',
    nome: c.nome?.trim() || '—',
    temCorrida,
    temNatacao,
    temPermanencia,
    faltam,
    postoGrad: c.categoria === 'Oficiais' ? c.oficial || '—' : c.praca || '—',
    categoria: c.categoria,
    situacao: alguma ? 'Parcial' : 'Sem teste',
  };
}

/** Militares cadastrados (e do histórico sem cadastro) com TAF incompleto. */
export function montarListaPendencias(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): PendenciaTafItem[] {
  const unificadas = unificarSessoesComCadastroRegistrador(sessoes, cadastros);
  const aggs = agregarHistoricoPorParticipante(unificadas, cadastros);
  const aggMap = aggPorCadastro(cadastros, aggs);

  const lista: PendenciaTafItem[] = [];
  const idsIncluidos = new Set<string>();

  for (const c of cadastros) {
    const item = itemFromCadastro(c, aggMap.get(c.id));
    if (!item) continue;
    lista.push(item);
    idsIncluidos.add(c.id);
    const nipC = nipDigitos(c.nip);
    if (nipC.length >= 8) idsIncluidos.add(`nip:${nipC}`);
  }

  for (const agg of aggs) {
    const nipA = nipDigitos(agg.nip);
    const chaveNip = nipA.length >= 8 ? `nip:${nipA}` : '';
    if (idsIncluidos.has(agg.id) || (chaveNip && idsIncluidos.has(chaveNip))) continue;
    const item = itemFromAgg(agg);
    if (!item) continue;
    lista.push(item);
    idsIncluidos.add(agg.id);
    if (chaveNip) idsIncluidos.add(chaveNip);
  }

  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function calcularContagemPendencias(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ContagemPendenciasTaf {
  const lista = montarListaPendencias(sessoes, cadastros);
  return {
    total: lista.length,
    corrida: lista.filter((p) => !p.temCorrida).length,
    natacao: lista.filter((p) => !p.temNatacao).length,
    permanencia: lista.filter((p) => !p.temPermanencia).length,
  };
}

export function filtrarPendencias(
  lista: PendenciaTafItem[],
  filtro: FiltroPendenciaTaf,
): PendenciaTafItem[] {
  switch (filtro) {
    case 'total':
      return lista;
    case 'corrida':
      return lista.filter((p) => !p.temCorrida);
    case 'natacao':
      return lista.filter((p) => !p.temNatacao);
    case 'permanencia':
      return lista.filter((p) => !p.temPermanencia);
    default:
      return lista;
  }
}
