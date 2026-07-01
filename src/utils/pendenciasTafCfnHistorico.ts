import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { compareByNomePtBr } from './compareNomePtBr';
import { formatNipInput, nipDigitos } from './nipFormat';
import { prepararDadosResultadosNorma } from './normaTafResultados';
import {
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';

export type ProvasCfnStatus = {
  corrida: boolean;
  natacao: boolean;
  permanencia: boolean;
  flexaoBarra: boolean;
  flexaoSolo: boolean;
  abdominalRemador: boolean;
  abdominalPrancha: boolean;
};

export type PendenciaCfnItem = {
  id: string;
  nip: string;
  nome: string;
  postoGrad: string;
  categoria: string;
  situacao: 'Sem teste' | 'Parcial';
  provas: ProvasCfnStatus;
  faltam: string[];
};

export type ConcluidoCfnItem = Omit<PendenciaCfnItem, 'situacao' | 'faltam'>;

const LABEL_PROVA: Record<keyof ProvasCfnStatus, string> = {
  corrida: 'Corrida 3200 m',
  natacao: 'Natação 100 m',
  permanencia: 'Permanência',
  flexaoBarra: 'Flexão na barra',
  flexaoSolo: 'Flexão no solo',
  abdominalRemador: 'Abdominal remador',
  abdominalPrancha: 'Abdominal prancha',
};

function temFlexaoBarra(c: CadastroItemPersist): boolean {
  return c.repsFlexaoBarra != null || !!(c.notaFlexaoBarra ?? '').trim();
}

function temFlexaoSolo(c: CadastroItemPersist): boolean {
  return c.repsFlexaoSolo != null || !!(c.notaFlexaoSolo ?? '').trim();
}

function temAbdominalRemador(c: CadastroItemPersist): boolean {
  return c.repsAbdominalRemador != null || !!(c.notaAbdominalRemador ?? '').trim();
}

function temAbdominalPrancha(c: CadastroItemPersist): boolean {
  return !!(c.tempoAbdominalPrancha ?? '').trim() || !!(c.notaAbdominalPrancha ?? '').trim();
}

function provasVazias(): ProvasCfnStatus {
  return {
    corrida: false,
    natacao: false,
    permanencia: false,
    flexaoBarra: false,
    flexaoSolo: false,
    abdominalRemador: false,
    abdominalPrancha: false,
  };
}

function provasFromCadastro(c: CadastroItemPersist): ProvasCfnStatus {
  return {
    corrida: temAvaliacaoCorrida(c),
    natacao: temAvaliacaoNatacao(c),
    permanencia: temAvaliacaoPermanencia(c),
    flexaoBarra: temFlexaoBarra(c),
    flexaoSolo: temFlexaoSolo(c),
    abdominalRemador: temAbdominalRemador(c),
    abdominalPrancha: temAbdominalPrancha(c),
  };
}

function mesclarProvas(a: ProvasCfnStatus, b: ProvasCfnStatus): ProvasCfnStatus {
  return {
    corrida: a.corrida || b.corrida,
    natacao: a.natacao || b.natacao,
    permanencia: a.permanencia || b.permanencia,
    flexaoBarra: a.flexaoBarra || b.flexaoBarra,
    flexaoSolo: a.flexaoSolo || b.flexaoSolo,
    abdominalRemador: a.abdominalRemador || b.abdominalRemador,
    abdominalPrancha: a.abdominalPrancha || b.abdominalPrancha,
  };
}

function todasProvasOk(p: ProvasCfnStatus): boolean {
  return Object.values(p).every(Boolean);
}

function faltamFromProvas(p: ProvasCfnStatus): string[] {
  const faltam: string[] = [];
  (Object.keys(LABEL_PROVA) as (keyof ProvasCfnStatus)[]).forEach((k) => {
    if (!p[k]) faltam.push(LABEL_PROVA[k]);
  });
  return faltam;
}

function marcarProvaSessao(p: ProvasCfnStatus, tipo: TipoProvaAplicada): ProvasCfnStatus {
  const next = { ...p };
  switch (tipo) {
    case 'corrida':
      next.corrida = true;
      break;
    case 'natacao':
      next.natacao = true;
      break;
    case 'permanencia':
      next.permanencia = true;
      break;
    case 'flexao_barra':
      next.flexaoBarra = true;
      break;
    case 'flexao_solo':
      next.flexaoSolo = true;
      break;
    case 'abdominal_remador':
      next.abdominalRemador = true;
      break;
    case 'abdominal_prancha':
      next.abdominalPrancha = true;
      break;
    default:
      break;
  }
  return next;
}

function chaveParticipanteAnon(nip: string, nome: string): string {
  const d = nipDigitos(nip);
  if (d.length >= 8) return `nip:${d}`;
  const n = nome.trim().toLowerCase();
  if (n.length >= 2) return `nome:${n}`;
  return '';
}

function idParticipante(r: ResultadoCorridaItem, cadastros: CadastroItemPersist[]): string {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip ?? '').trim() || (r.nome ?? '').trim(),
  );
  if (busca.kind === 'found') return busca.cadastro.id;
  return chaveParticipanteAnon(r.nip ?? '', r.nome ?? '');
}

type AggCfn = {
  id: string;
  nip: string;
  nome: string;
  provas: ProvasCfnStatus;
};

function agregarCfnPorParticipante(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): AggCfn[] {
  const map = new Map<string, AggCfn>();
  const ordenadas = [...sessoes].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  for (const sessao of ordenadas) {
    for (const r of sessao.resultados ?? []) {
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
          provas: provasVazias(),
        };
        map.set(id, agg);
      }

      agg.provas = marcarProvaSessao(agg.provas, sessao.tipoProva);
      const nipFmt = formatNipInput(r.nip ?? '');
      if (nipFmt.trim()) agg.nip = nipFmt;
      const nome = (r.nome ?? '').trim();
      if (nome) agg.nome = nome;
    }
  }

  for (const c of cadastros) {
    const provasCad = provasFromCadastro(c);
    if (!Object.values(provasCad).some(Boolean)) continue;

    let agg = map.get(c.id);
    if (!agg) {
      const nipC = nipDigitos(c.nip);
      if (nipC.length >= 8) {
        for (const row of map.values()) {
          if (nipDigitos(row.nip) === nipC) {
            agg = row;
            break;
          }
        }
      }
    }
    if (!agg) {
      agg = {
        id: c.id,
        nip: formatNipInput(c.nip ?? '') || '—',
        nome: (c.nome ?? '').trim() || '—',
        provas: provasVazias(),
      };
      map.set(c.id, agg);
    }
    agg.provas = mesclarProvas(agg.provas, provasCad);
    agg.nip = formatNipInput(c.nip ?? '') || agg.nip;
    agg.nome = (c.nome ?? '').trim() || agg.nome;
  }

  return [...map.values()].filter((agg) => Object.values(agg.provas).some(Boolean));
}

function itemPendenciaFromAgg(agg: AggCfn): PendenciaCfnItem | null {
  if (todasProvasOk(agg.provas)) return null;
  const faltam = faltamFromProvas(agg.provas);
  const alguma = Object.values(agg.provas).some(Boolean);
  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    postoGrad: '—',
    categoria: '—',
    situacao: alguma ? 'Parcial' : 'Sem teste',
    provas: agg.provas,
    faltam,
  };
}

function itemPendenciaFromCadastro(
  c: CadastroItemPersist,
  agg: AggCfn | undefined,
): PendenciaCfnItem | null {
  const provas = mesclarProvas(agg?.provas ?? provasVazias(), provasFromCadastro(c));
  if (todasProvasOk(provas)) return null;
  const faltam = faltamFromProvas(provas);
  const alguma = Object.values(provas).some(Boolean);
  return {
    id: c.id,
    nip: c.nip?.trim() || '—',
    nome: c.nome?.trim() || '—',
    postoGrad: c.categoria === 'Oficiais' ? c.oficial || '—' : c.praca || '—',
    categoria: c.categoria,
    situacao: alguma ? 'Parcial' : 'Sem teste',
    provas,
    faltam,
  };
}

function itemConcluidoFromAgg(agg: AggCfn): ConcluidoCfnItem | null {
  if (!todasProvasOk(agg.provas)) return null;
  return {
    id: agg.id,
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    postoGrad: '—',
    categoria: '—',
    provas: agg.provas,
  };
}

function itemConcluidoFromCadastro(c: CadastroItemPersist, agg: AggCfn | undefined): ConcluidoCfnItem | null {
  const provas = mesclarProvas(agg?.provas ?? provasVazias(), provasFromCadastro(c));
  if (!todasProvasOk(provas)) return null;
  return {
    id: c.id,
    nip: c.nip?.trim() || '—',
    nome: c.nome?.trim() || '—',
    postoGrad: c.categoria === 'Oficiais' ? c.oficial || '—' : c.praca || '—',
    categoria: c.categoria,
    provas,
  };
}

function montarListaCfn<T>(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  mapItemCadastro: (c: CadastroItemPersist, agg: AggCfn | undefined) => T | null,
  mapItemAgg: (agg: AggCfn) => T | null,
): T[] {
  const { sessoesNorma, cadastrosNorma } = prepararDadosResultadosNorma(sessoes, cadastros, 'cfn');
  const aggs = agregarCfnPorParticipante(sessoesNorma, cadastrosNorma);
  const aggMap = new Map<string, AggCfn>();
  for (const agg of aggs) aggMap.set(agg.id, agg);
  for (const agg of aggs) {
    const nipA = nipDigitos(agg.nip);
    if (nipA.length < 8) continue;
    for (const c of cadastrosNorma) {
      if (nipDigitos(c.nip) === nipA) aggMap.set(c.id, agg);
    }
  }

  const lista: T[] = [];
  const idsIncluidos = new Set<string>();

  for (const c of cadastrosNorma) {
    const item = mapItemCadastro(c, aggMap.get(c.id));
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
    const item = mapItemAgg(agg);
    if (!item) continue;
    lista.push(item);
    idsIncluidos.add(agg.id);
    if (chaveNip) idsIncluidos.add(chaveNip);
  }

  return lista.sort(compareByNomePtBr);
}

export function montarListaPendenciasCfn(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): PendenciaCfnItem[] {
  return montarListaCfn(sessoes, cadastros, itemPendenciaFromCadastro, itemPendenciaFromAgg);
}

export function montarListaConcluidosCfn(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ConcluidoCfnItem[] {
  return montarListaCfn(sessoes, cadastros, itemConcluidoFromCadastro, itemConcluidoFromAgg);
}

export const CFN_CHIP_LABELS: { key: keyof ProvasCfnStatus; label: string }[] = [
  { key: 'corrida', label: 'Corrida' },
  { key: 'natacao', label: 'Natação' },
  { key: 'permanencia', label: 'Permanência' },
  { key: 'flexaoBarra', label: 'Flex. barra' },
  { key: 'flexaoSolo', label: 'Flex. solo' },
  { key: 'abdominalRemador', label: 'Abd. remador' },
  { key: 'abdominalPrancha', label: 'Abd. prancha' },
];
