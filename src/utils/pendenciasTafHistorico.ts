import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { nipDigitos } from './nipFormat';
import type { PendenciaParcialItem } from './resultadoTafCadastro';
import {
  temAvaliacaoCorridaOuCaminhada,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { agregarHistoricoPorParticipante } from './resultadoGeralHistorico';
import { unificarSessoesComCadastroRegistrador } from './sessoesUnificadasResultados';
import { compareByNomePtBr } from './compareNomePtBr';
import { filtrarSessoesPorNorma } from './normaTafResultados';
export type FiltroPendenciaTaf = 'total' | 'parcial' | 'corrida' | 'natacao' | 'permanencia';

export type PendenciaTafItem = PendenciaParcialItem & {
  postoGrad: string;
  categoria: string;
  situacao: 'Sem teste' | 'Parcial';
};

export type ContagemPendenciasTaf = Record<'total' | 'corrida' | 'natacao' | 'permanencia', number>;

export const FILTRO_PENDENCIA_LABEL: Record<FiltroPendenciaTaf, string> = {
  total: 'Pendência Total',
  parcial: 'Pendência Parcial',
  corrida: 'Pendência Corrida',
  natacao: 'Pendência Natação',
  permanencia: 'Pendência Permanência',
};

function aggPorCadastro(
  cadastros: CadastroItemPersist[],
  aggs: ReturnType<typeof agregarHistoricoPorParticipante>,
): Map<string, (typeof aggs)[number]> {
  const porId = new Map<string, (typeof aggs)[number]>();
  const aggByNip = new Map<string, (typeof aggs)[number]>();
  for (const agg of aggs) {
    porId.set(agg.id, agg);
    const nipA = nipDigitos(agg.nip);
    if (nipA.length >= 8 && !aggByNip.has(nipA)) aggByNip.set(nipA, agg);
  }
  for (const c of cadastros) {
    const nipC = nipDigitos(c.nip);
    if (nipC.length < 8) continue;
    const agg = aggByNip.get(nipC);
    if (agg) porId.set(c.id, agg);
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
  const temNatacao = !!agg?.natacao || temAvaliacaoNatacao(c);
  const temPermanencia = !!agg?.permanencia || temAvaliacaoPermanencia(c);
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
  opts?: { jaUnificadas?: boolean },
): PendenciaTafItem[] {
  const unificadas = opts?.jaUnificadas
    ? sessoes
    : unificarSessoesComCadastroRegistrador(sessoes, cadastros);
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

  return lista.sort(compareByNomePtBr);
}

/** Militares com ao menos um teste e TAF incompleto. */
export function filtrarPendenciasParciais(lista: PendenciaTafItem[]): PendenciaTafItem[] {
  return lista.filter((p) => p.situacao === 'Parcial');
}

/** Militares cadastrados que ainda não fizeram nenhum teste. */
export function filtrarPendenciasTotais(lista: PendenciaTafItem[]): PendenciaTafItem[] {
  return lista.filter((p) => p.situacao === 'Sem teste');
}

/**
 * Pendência Total (Armada): todos os cadastros sem nenhum teste Armada.
 * Usa a base completa de cadastros (não só quem já tem resultado).
 */
export function montarListaPendenciasTotais(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
  opts?: { jaUnificadas?: boolean },
): PendenciaTafItem[] {
  const sessoesSemDemo = sessoes.filter((s) => !s.id.startsWith('demo-sess-'));
  const cadastrosSemDemo = cadastros.filter((c) => !c.id.startsWith('demo-cad-'));
  const unificadas = opts?.jaUnificadas
    ? sessoesSemDemo
    : unificarSessoesComCadastroRegistrador(sessoesSemDemo, cadastrosSemDemo);
  const sessoesArmada = filtrarSessoesPorNorma(unificadas, 'armada');
  return filtrarPendenciasTotais(
    montarListaPendencias(sessoesArmada, cadastrosSemDemo, { jaUnificadas: true }),
  );
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
    case 'parcial':
      return lista.filter((p) => p.situacao === 'Parcial');
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

export type ConcluidoTafItem = {
  id: string;
  nip: string;
  nome: string;
  postoGrad: string;
  categoria: string;
  temCorrida: boolean;
  temNatacao: boolean;
  temPermanencia: boolean;
};

function concluidoFromAgg(
  agg: ReturnType<typeof agregarHistoricoPorParticipante>[number],
): ConcluidoTafItem | null {
  if (itemFromAgg(agg)) return null;
  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    postoGrad: '—',
    categoria: '—',
    temCorrida: true,
    temNatacao: true,
    temPermanencia: true,
  };
}

function concluidoFromCadastro(
  c: CadastroItemPersist,
  agg: ReturnType<typeof agregarHistoricoPorParticipante>[number] | undefined,
): ConcluidoTafItem | null {
  if (itemFromCadastro(c, agg)) return null;
  return {
    id: c.id,
    nip: c.nip?.trim() || '—',
    nome: c.nome?.trim() || '—',
    postoGrad: c.categoria === 'Oficiais' ? c.oficial || '—' : c.praca || '—',
    categoria: c.categoria,
    temCorrida: true,
    temNatacao: true,
    temPermanencia: true,
  };
}

/** Militares cadastrados (e do histórico sem cadastro) com todas as modalidades do TAF concluídas. */
export function montarListaConcluidos(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
  opts?: { jaUnificadas?: boolean },
): ConcluidoTafItem[] {
  const unificadas = opts?.jaUnificadas
    ? sessoes
    : unificarSessoesComCadastroRegistrador(sessoes, cadastros);
  const aggs = agregarHistoricoPorParticipante(unificadas, cadastros);
  const aggMap = aggPorCadastro(cadastros, aggs);

  const lista: ConcluidoTafItem[] = [];
  const idsIncluidos = new Set<string>();

  for (const c of cadastros) {
    const item = concluidoFromCadastro(c, aggMap.get(c.id));
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
    const item = concluidoFromAgg(agg);
    if (!item) continue;
    lista.push(item);
    idsIncluidos.add(agg.id);
    if (chaveNip) idsIncluidos.add(chaveNip);
  }

  return lista.sort(compareByNomePtBr);
}
