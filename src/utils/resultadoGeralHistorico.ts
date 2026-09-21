import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf, TipoProvaAplicada } from '../services/resultadosAplicadosIndexedDb';
import { tempoMaximoNota50Caminhada4800 } from '../taf/caminhada4800Nota';
import { tempoMaximoNota50Corrida2400, textoNotaCorridaFromCadastro } from '../taf/corrida2400Nota';
import { tempoMaximoNota50Corrida3200 } from '../taf/corrida3200Nota';
import { tempoMaximoNota50Natacao100 } from '../taf/natacao100Nota';
import { tempoMaximoNota50Natacao, textoNotaNatacaoFromCadastro } from '../taf/natacaoNota';
import { formatMsByModality } from '../taf/tafTimeFormat';
import {
  buildCadastroLookupIndex,
  buscarCadastroIndexed,
  type CadastroLookupIndex,
} from './cadastroLookupIndex';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { idadeFromDataNascimento } from './idadeFromDataNascimento';
import { formatNipInput, nipChaveCadastro, nipDigitos } from './nipFormat';
import type { PendenciaParcialItem, ResultadoGeralItem, ResultadoTafLinha } from './resultadoTafCadastro';
import {
  postoGradFromLinhaId,
  temAvaliacaoCaminhada,
  temAvaliacaoCorrida,
  temAvaliacaoCorridaOuCaminhada,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { unificarSessoesComCadastroRegistrador } from './sessoesUnificadasResultados';
import { compareByNomePtBr } from './compareNomePtBr';
import { isDemoCadastroId, isDemoSessaoId } from './gatherSystemBackupData';
import { cadastroIncompletoNascimentoOuFatores } from './cadastroIncompleto';
import { isNotaReprovacaoTexto } from './notaReprovacaoTexto';
import { postoGradComVinculo } from './formatNomeComPosto';
import type { ModalidadeResultadoTaf } from './limparResultadoModalidade';

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
  caminhada?: ModalidadeHistorico;
  natacao?: ModalidadeHistorico;
  permanencia?: ModalidadeHistorico;
  corridaSessaoEm?: string;
  caminhadaSessaoEm?: string;
  natacaoSessaoEm?: string;
  permanenciaSessaoEm?: string;
  /** CFN */
  flexaoBarra?: ModalidadeHistorico;
  flexaoSolo?: ModalidadeHistorico;
  abdominalRemador?: ModalidadeHistorico;
  abdominalPrancha?: ModalidadeHistorico;
};

function temRequisitoCorridaOuCaminhada(agg: AggRow): boolean {
  return !!(agg.corrida || agg.caminhada);
}

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
  index: CadastroLookupIndex,
): string {
  const busca = buscarCadastroIndexed(
    index,
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
  if (isNotaReprovacaoTexto(nota)) return 'Reprovado';
  if (nota.toLowerCase() === 'aprovado') return 'Aprovado';
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
  const modality = tipo === 'natacao' ? 'natacao' : 'corrida';
  const tempoFmt =
    typeof r.tempoMs === 'number' && r.tempoMs > 0
      ? formatMsByModality(modality, r.tempoMs).trim() || undefined
      : undefined;
  return {
    nota: notaFromResultado(r),
    situacao: situacaoFromResultado(r),
    ...(tempoFmt ? { tempo: tempoFmt } : {}),
    rubricaSvg: r.rubricaCandidatoSvg,
  };
}

function atualizarIdentidade(
  agg: AggRow,
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
  index: CadastroLookupIndex,
) {
  const busca = buscarCadastroIndexed(
    index,
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

function metaCorridaCaminhadaFromCadastro(
  agg: AggRow,
  cadastros: CadastroItemPersist[],
  index: CadastroLookupIndex,
): Pick<
  ResultadoGeralItem,
  | 'dataTafCorrida'
  | 'dataTafCaminhada'
  | 'modalidadeDistanciaAtiva'
  | 'corridaRegistradaEm'
  | 'caminhadaRegistradaEm'
> {
  const busca = buscarCadastroIndexed(index, cadastros, (agg.nip ?? '').trim() || agg.nome);
  const c = busca.kind === 'found' ? busca.cadastro : undefined;
  return {
    dataTafCorrida: c && temAvaliacaoCorrida(c) ? (c.dataTafCorrida || '').trim() || undefined : undefined,
    dataTafCaminhada:
      c && temAvaliacaoCaminhada(c) ? (c.dataTafCaminhada || '').trim() || undefined : undefined,
    modalidadeDistanciaAtiva: c?.modalidadeDistanciaAtiva,
    corridaRegistradaEm: agg.corridaSessaoEm,
    caminhadaRegistradaEm: agg.caminhadaSessaoEm,
  };
}

function aggParaLinha(agg: AggRow): ResultadoGeralItem {
  const temCorrida = !!agg.corrida;
  const temCaminhada = !!agg.caminhada;
  const temNatacao = !!agg.natacao;
  const temPerm = !!agg.permanencia;
  const temFlexBarra = !!agg.flexaoBarra;
  const temFlexSolo = !!agg.flexaoSolo;
  const temAbdRemador = !!agg.abdominalRemador;
  const temAbdPrancha = !!agg.abdominalPrancha;
  const requisitoCorrida = temRequisitoCorridaOuCaminhada(agg);
  const isCfn = temFlexBarra || temFlexSolo || temAbdRemador || temAbdPrancha;

  let statusTaf: 'Completo' | 'Parcial';
  if (isCfn) {
    const temForca = temFlexBarra || temFlexSolo;
    const temAbdome = temAbdRemador || temAbdPrancha;
    const temAqua = temNatacao || temPerm;
    statusTaf = temForca && temAbdome && temAqua ? 'Completo' : 'Parcial';
  } else {
    statusTaf = requisitoCorrida && temNatacao && temPerm ? 'Completo' : 'Parcial';
  }

  return {
    id: agg.id,
    postoGrad: '—',
    nip: agg.nip || '—',
    nome: agg.nome || '—',
    notaCorrida: temCorrida ? agg.corrida!.nota : '—',
    situacaoCorrida: temCorrida ? agg.corrida!.situacao : '—',
    ...(temCorrida && agg.corrida!.tempo
      ? { tempoCorrida: agg.corrida!.tempo }
      : {}),
    notaCaminhada: temCaminhada ? agg.caminhada!.nota : '—',
    situacaoCaminhada: temCaminhada ? agg.caminhada!.situacao : '—',
    ...(temCaminhada && agg.caminhada!.tempo
      ? { tempoCaminhada: agg.caminhada!.tempo }
      : {}),
    notaNatacao: temNatacao ? agg.natacao!.nota : '—',
    situacaoNatacao: temNatacao ? agg.natacao!.situacao : '—',
    ...(temNatacao && agg.natacao!.tempo
      ? { tempoNatacao: agg.natacao!.tempo }
      : {}),
    permanenciaTempo: temPerm ? (agg.permanencia!.tempo ?? '—') : '—',
    situacaoPermanencia: temPerm ? agg.permanencia!.situacao : '—',
    rubricaCorridaSvg: agg.corrida?.rubricaSvg,
    rubricaCaminhadaSvg: agg.caminhada?.rubricaSvg,
    rubricaNatacaoSvg: agg.natacao?.rubricaSvg,
    rubricaPermanenciaSvg: agg.permanencia?.rubricaSvg,
    notaFlexaoBarra: temFlexBarra ? agg.flexaoBarra!.nota : '—',
    situacaoFlexaoBarra: temFlexBarra ? agg.flexaoBarra!.situacao : '—',
    notaFlexaoSolo: temFlexSolo ? agg.flexaoSolo!.nota : '—',
    situacaoFlexaoSolo: temFlexSolo ? agg.flexaoSolo!.situacao : '—',
    notaAbdominalRemador: temAbdRemador ? agg.abdominalRemador!.nota : '—',
    situacaoAbdominalRemador: temAbdRemador ? agg.abdominalRemador!.situacao : '—',
    notaAbdominalPrancha: temAbdPrancha ? agg.abdominalPrancha!.nota : '—',
    situacaoAbdominalPrancha: temAbdPrancha ? agg.abdominalPrancha!.situacao : '—',
    statusTaf,
  };
}

function mergeKeyForParticipante(
  map: Map<string, AggRow>,
  preferredId: string,
  nip: string,
): { key: string; agg?: AggRow } {
  const d = nipDigitos(nip);
  if (d.length >= 8) {
    for (const [key, row] of map) {
      if (nipDigitos(row.nip) !== d) continue;
      const preferCadastroId =
        preferredId &&
        !preferredId.startsWith('nip:') &&
        !preferredId.startsWith('nome:') &&
        preferredId !== key;
      if (preferCadastroId) {
        map.delete(key);
        row.id = preferredId;
        map.set(preferredId, row);
        return { key: preferredId, agg: row };
      }
      return { key, agg: row };
    }
  }
  const existing = map.get(preferredId);
  if (existing) return { key: preferredId, agg: existing };
  return { key: preferredId };
}

/** Agrega participantes e modalidades a partir das sessões do Histórico (sessão mais recente prevalece). */
export function agregarHistoricoPorParticipante(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): AggRow[] {
  const index = buildCadastroLookupIndex(cadastros);
  const map = new Map<string, AggRow>();
  const ordenadas = [...sessoes]
    .filter((s) => !isDemoSessaoId(s.id))
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));

  for (const sessao of ordenadas) {
    const tipo = sessao.tipoProva;
    for (const r of sessao.resultados ?? []) {
      const id = idParticipante(r, cadastros, index);
      if (!id) continue;

      const busca = buscarCadastroIndexed(
        index,
          cadastros,
          (r.nip ?? '').trim() || (r.nome ?? '').trim(),
        );
      const nipHint =
        busca.kind === 'found' ? (busca.cadastro.nip ?? '') : (r.nip ?? '');
      const merged = mergeKeyForParticipante(map, id, nipHint);
      let agg = merged.agg;
      if (!agg) {
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
        map.set(merged.key, agg);
      }

      atualizarIdentidade(agg, r, cadastros, index);
      const slice = sliceFromResultado(tipo, r);

      if (tipo === 'corrida') {
        agg.corrida = slice;
        agg.corridaSessaoEm = sessao.dataAplicacao || sessao.criadoEm;
      } else if (tipo === 'caminhada') {
        agg.caminhada = slice;
        agg.caminhadaSessaoEm = sessao.dataAplicacao || sessao.criadoEm;
      } else if (tipo === 'natacao') {
        agg.natacao = slice;
        agg.natacaoSessaoEm = sessao.dataAplicacao || sessao.criadoEm;
      } else if (tipo === 'permanencia') {
        agg.permanencia = slice;
        agg.permanenciaSessaoEm = sessao.dataAplicacao || sessao.criadoEm;
      } else if (tipo === 'flexao_barra') agg.flexaoBarra = slice;
      else if (tipo === 'flexao_solo') agg.flexaoSolo = slice;
      else if (tipo === 'abdominal_remador') agg.abdominalRemador = slice;
      else if (tipo === 'abdominal_prancha') agg.abdominalPrancha = slice;
    }
  }

  enriquecerCorridaCaminhadaFromCadastros(map, cadastros, index);
  enriquecerPermanenciaFromCadastros(map, cadastros, index);
  enriquecerCfnFromCadastros(map, cadastros, index);

  return [...map.values()].filter(
    (agg) =>
      agg.corrida || agg.caminhada || agg.natacao || agg.permanencia ||
      agg.flexaoBarra || agg.flexaoSolo || agg.abdominalRemador || agg.abdominalPrancha,
  );
}

function situacaoFromNotaCadastro(nota: string | undefined): string {
  const n = (nota || '').trim();
  if (!n) return '—';
  if (isNotaReprovacaoTexto(n)) return 'Reprovado';
  return 'Aprovado';
}

function findAggForCadastro(
  map: Map<string, AggRow>,
  c: CadastroItemPersist,
  byNipAgg: Map<string, AggRow>,
): AggRow | undefined {
  const byId = map.get(c.id);
  if (byId) return byId;
    const nipC = nipDigitos(c.nip);
  if (nipC.length >= 8) return byNipAgg.get(nipC);
  return undefined;
}

function buildAggByNip(map: Map<string, AggRow>): Map<string, AggRow> {
  const byNip = new Map<string, AggRow>();
      for (const row of map.values()) {
    const d = nipDigitos(row.nip);
    if (d.length >= 8 && !byNip.has(d)) byNip.set(d, row);
  }
  return byNip;
}

function enriquecerCorridaCaminhadaFromCadastros(
  map: Map<string, AggRow>,
  cadastros: CadastroItemPersist[],
  _index: CadastroLookupIndex,
): void {
  const byNipAgg = buildAggByNip(map);
  for (const c of cadastros) {
    const agg = findAggForCadastro(map, c, byNipAgg);
    if (!agg) continue;

    if (temAvaliacaoCorrida(c)) {
      const notaAtual = (agg.corrida?.nota ?? '').trim();
      const tempoCad = (c.tempoCorrida ?? (c as CadastroItemPersist & { tempo?: string }).tempo ?? '')
        .trim();
      if (!notaAtual || notaAtual === '—') {
        const nota = c.notaCorrida?.trim();
        agg.corrida = {
          nota: nota || '—',
          situacao: situacaoFromNotaCadastro(nota),
          ...(tempoCad ? { tempo: tempoCad } : {}),
          rubricaSvg: c.rubricaCorridaSvg,
        };
      } else if (!agg.corrida?.tempo && tempoCad) {
        agg.corrida = { ...agg.corrida!, tempo: tempoCad };
      }
    }

    if (temAvaliacaoCaminhada(c)) {
      const notaAtual = (agg.caminhada?.nota ?? '').trim();
      const tempoCad = (c.tempoCaminhada ?? '').trim();
      if (!notaAtual || notaAtual === '—') {
        const nota = c.notaCaminhada?.trim();
        agg.caminhada = {
          nota: nota || '—',
          situacao: situacaoFromNotaCadastro(nota),
          ...(tempoCad ? { tempo: tempoCad } : {}),
          rubricaSvg: c.rubricaCaminhadaSvg,
        };
      } else if (!agg.caminhada?.tempo && tempoCad) {
        agg.caminhada = { ...agg.caminhada!, tempo: tempoCad };
      }
    }
  }
}

function enriquecerPermanenciaFromCadastros(
  map: Map<string, AggRow>,
  cadastros: CadastroItemPersist[],
  _index: CadastroLookupIndex,
): void {
  const byNipAgg = buildAggByNip(map);
  for (const c of cadastros) {
    const r = c.resultadoPermanencia ?? c.resultadoNatacao;
    if (r !== 'aprovado' && r !== 'reprovado') continue;

    const agg = findAggForCadastro(map, c, byNipAgg);
    if (!agg) continue;

    const sitAtual = agg.permanencia?.situacao;
    if (sitAtual && sitAtual !== '—') continue;

    agg.permanencia = {
      nota: '—',
      situacao: r === 'reprovado' ? 'Reprovado' : 'Aprovado',
      tempo: (c.tempoPermanencia ?? '').trim() || PERMANENCIA_TEMPO_PDF_PADRAO,
      rubricaSvg: c.rubricaPermanenciaSvg ?? agg.permanencia?.rubricaSvg,
    };
  }
}

function enriquecerCfnFromCadastros(
  map: Map<string, AggRow>,
  cadastros: CadastroItemPersist[],
  _index: CadastroLookupIndex,
): void {
  const byNipAgg = buildAggByNip(map);
  for (const c of cadastros) {
    const agg = findAggForCadastro(map, c, byNipAgg);
    if (!agg) {
      // cadastro CFN sem sessão — criar entrada nova se tiver algum resultado CFN
      const temCfn =
        (c.notaFlexaoBarra ?? '').trim() || c.repsFlexaoBarra != null ||
        (c.notaFlexaoSolo ?? '').trim() || c.repsFlexaoSolo != null ||
        (c.notaAbdominalRemador ?? '').trim() || c.repsAbdominalRemador != null ||
        (c.notaAbdominalPrancha ?? '').trim() || (c.tempoAbdominalPrancha ?? '').trim();
      if (!temCfn) continue;
      const nipD = nipDigitos(c.nip ?? '');
      const key = nipD.length >= 8 ? `nip:${nipD}` : `id:${c.id}`;
      const novo: AggRow = {
        id: c.id,
        nip: c.nip ?? '—',
        nome: c.nome ?? '—',
      };
      map.set(key, novo);
      preencherCfnEmAgg(novo, c);
      continue;
    }
    preencherCfnEmAgg(agg, c);
  }
}

function preencherCfnEmAgg(agg: AggRow, c: CadastroItemPersist): void {
  const notaFB = (c.notaFlexaoBarra ?? '').trim();
  if (notaFB || c.repsFlexaoBarra != null) {
    if (!agg.flexaoBarra?.nota || agg.flexaoBarra.nota === '—') {
      agg.flexaoBarra = { nota: notaFB || '—', situacao: situacaoFromNotaCadastro(notaFB) };
    }
  }
  const notaFS = (c.notaFlexaoSolo ?? '').trim();
  if (notaFS || c.repsFlexaoSolo != null) {
    if (!agg.flexaoSolo?.nota || agg.flexaoSolo.nota === '—') {
      agg.flexaoSolo = { nota: notaFS || '—', situacao: situacaoFromNotaCadastro(notaFS) };
    }
  }
  const notaAR = (c.notaAbdominalRemador ?? '').trim();
  if (notaAR || c.repsAbdominalRemador != null) {
    if (!agg.abdominalRemador?.nota || agg.abdominalRemador.nota === '—') {
      agg.abdominalRemador = { nota: notaAR || '—', situacao: situacaoFromNotaCadastro(notaAR) };
    }
  }
  const notaAP = (c.notaAbdominalPrancha ?? '').trim();
  const tempoAP = (c.tempoAbdominalPrancha ?? '').trim();
  if (notaAP || tempoAP) {
    if (!agg.abdominalPrancha?.nota || agg.abdominalPrancha.nota === '—') {
      agg.abdominalPrancha = {
        nota: notaAP || '—',
        situacao: situacaoFromNotaCadastro(notaAP),
        tempo: tempoAP || undefined,
      };
    }
  }
}

function aggParaPendenciaParcial(agg: AggRow): PendenciaParcialItem | null {
  const temCorrida = temRequisitoCorridaOuCaminhada(agg);
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
 * Monta o Resultado Geral a partir do Histórico (Aplicar TAF + Registrador de TAF).
 * Modalidades ausentes aparecem como "—" na tabela.
 */
export function listarResultadosGeralFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
  opts?: { somenteSessoesInformadas?: boolean; jaUnificadas?: boolean },
): ResultadoGeralItem[] {
  const sessoesReais = sessoes.filter((s) => !isDemoSessaoId(s.id));
  const cadastrosReais = cadastros.filter((c) => !isDemoCadastroId(c.id));
  const index = buildCadastroLookupIndex(cadastrosReais);
  // PDF do dia / painéis com dataset já unificado: não remisturar virtuais.
  const base =
    opts?.somenteSessoesInformadas || opts?.jaUnificadas
      ? sessoesReais
      : unificarSessoesComCadastroRegistrador(sessoesReais, cadastrosReais);
  return agregarHistoricoPorParticipante(base, cadastrosReais)
    .map((agg) => ({
      ...aggParaLinha(agg),
      ...metaCorridaCaminhadaFromCadastro(agg, cadastrosReais, index),
      postoGrad: postoGradFromLinhaId(agg.id, agg.nip, cadastrosReais),
    }))
    .sort(compareByNomePtBr);
}

/**
 * Militares com ao menos uma modalidade no Histórico, mas sem as três.
 */
export function listarPendenciasParciaisFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
  opts?: { jaUnificadas?: boolean },
): PendenciaParcialItem[] {
  const sessoesReais = sessoes.filter((s) => !isDemoSessaoId(s.id));
  const cadastrosReais = cadastros.filter((c) => !isDemoCadastroId(c.id));
  const unificadas = opts?.jaUnificadas
    ? sessoesReais
    : unificarSessoesComCadastroRegistrador(sessoesReais, cadastrosReais);
  return agregarHistoricoPorParticipante(unificadas, cadastrosReais)
    .map(aggParaPendenciaParcial)
    .filter((item): item is PendenciaParcialItem => item != null)
    .sort(compareByNomePtBr);
}

/** Militares com as três modalidades registradas no Histórico. */
export function listarResultadosCompletosFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ResultadoGeralItem[] {
  return listarResultadosGeralFromHistorico(sessoes, cadastros).filter(
    (l) => l.statusTaf === 'Completo',
  );
}

/** Enriquece linhas do cadastro com datas/sessões de corrida × caminhada do Histórico. */
export function enriquecerLinhasDistanciaMetaFromHistorico(
  linhas: ResultadoTafLinha[],
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[] = [],
): ResultadoTafLinha[] {
  const unificadas = unificarSessoesComCadastroRegistrador(sessoes, cadastros);
  const aggs = agregarHistoricoPorParticipante(unificadas, cadastros);
  const index = buildCadastroLookupIndex(cadastros);
  const byId = new Map(aggs.map((a) => [a.id, a]));

  return linhas.map((linha) => {
    let agg = byId.get(linha.id);
    if (!agg) {
      const nipC = nipDigitos(linha.nip);
      if (nipC.length >= 8) {
        agg = aggs.find((a) => nipDigitos(a.nip) === nipC);
      }
    }
    if (!agg) return linha;
    return { ...linha, ...metaCorridaCaminhadaFromCadastro(agg, cadastros, index) };
  });
}

export type ResumoInicioTafHistorico = {
  totalCadastrados: number;
  /** Cadastrados com as três modalidades no Histórico. */
  completos: number;
  /** Cadastrados com ao menos uma modalidade no Histórico, sem as três. */
  parcial: number;
  /** Cadastrados sem nenhuma modalidade no Histórico. */
  semTeste: number;
  /** Cadastrados com dispensa ativa (Restritos) — fora de pendente e concluído. */
  restritos: number;
  /** Cadastrados com formulário de fatores de risco totalmente preenchido (com ou sem alerta). */
  fatoresRisco: number;
  /**
   * Sem data de nascimento válida e/ou sem fatores de risco preenchidos
   * (ou só um dos dois).
   */
  cadastroIncompleto: number;
  /** Cadastrados reprovados em pelo menos um teste (qualquer modalidade). */
  reprovados: number;
};

function findAggRowForCadastro(aggs: AggRow[], c: CadastroItemPersist): AggRow | undefined {
  const byId = aggs.find((agg) => agg.id === c.id);
  if (byId) return byId;
  const nipC = nipDigitos(c.nip);
  if (nipC.length < 8) return undefined;
  return aggs.find((agg) => nipDigitos(agg.nip) === nipC);
}

function classificarAggNoResumo(agg: AggRow): 'completo' | 'parcial' | 'vazio' {
  const requisitoCorrida = temRequisitoCorridaOuCaminhada(agg);
  const temNatacao = !!agg.natacao;
  const temPerm = !!agg.permanencia;
  // Armada: completo = corrida/caminhada + natação + permanência
  if (requisitoCorrida && temNatacao && temPerm) return 'completo';

  // CFN: completo = força (barra ou solo) + abdome (remador ou prancha) + aquático
  const temForca = !!(agg.flexaoBarra || agg.flexaoSolo);
  const temAbdome = !!(agg.abdominalRemador || agg.abdominalPrancha);
  const temAqua = temNatacao || temPerm;
  if (temForca && temAbdome && temAqua) return 'completo';

  // Parcial: ao menos uma modalidade de qualquer norma
  if (
    requisitoCorrida || temNatacao || temPerm ||
    temForca || temAbdome
  ) return 'parcial';

  return 'vazio';
}

function modalidadeEhReprovada(m?: ModalidadeHistorico): boolean {
  if (!m) return false;
  if ((m.situacao ?? '').trim().toLowerCase() === 'reprovado') return true;
  if ((m.situacao ?? '').trim().toLowerCase() === 'desistência' || (m.situacao ?? '').trim().toLowerCase() === 'desistencia') {
    return true;
  }
  return isNotaReprovacaoTexto(m.nota);
}

/** Timestamp para comparar cadastro vs última sessão (ISO ou DD/MM/AAAA). */
function dataVigenciaMs(raw?: string | null): number | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : null;
  }
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  return Number.isFinite(t) ? t : null;
}

/**
 * Resultado vigente da modalidade: se cadastro e sessão divergem, usa o mais recente;
 * em empate/sem data, a sessão agregada (última aplicação) prevalece.
 * Assim, ao ser aprovado depois de reprovado, some do card Reprovados.
 */
function modalidadeVigenteReprovada(
  cadastro: { ativo: boolean; reprovado: boolean; data?: string | null },
  sessao: { ativo: boolean; reprovado: boolean; data?: string | null },
): boolean {
  if (!cadastro.ativo && !sessao.ativo) return false;
  if (cadastro.ativo && !sessao.ativo) return cadastro.reprovado;
  if (!cadastro.ativo && sessao.ativo) return sessao.reprovado;
  const tc = dataVigenciaMs(cadastro.data);
  const ts = dataVigenciaMs(sessao.data);
  if (tc != null && ts != null && tc !== ts) {
    return tc > ts ? cadastro.reprovado : sessao.reprovado;
  }
  return sessao.reprovado;
}

function notaCorridaVigenteNoCadastro(c: CadastroItemPersist): string {
  if (c.normaTaf === 'cfn' && (c.tempoCorrida ?? '').trim()) {
    return (
      textoNotaCorridaFromCadastro({
        tempoCorrida: c.tempoCorrida,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
        normaTaf: 'cfn',
      }) || ''
    ).trim();
  }
  return (c.notaCorrida ?? '').trim();
}

function notaNatacaoVigenteNoCadastro(c: CadastroItemPersist): string {
  if (c.normaTaf === 'cfn' && (c.tempoNatacao ?? '').trim()) {
    return (
      textoNotaNatacaoFromCadastro({
        tempoNatacao: c.tempoNatacao,
        dataNascimento: c.dataNascimento,
        sexo: c.sexo,
        normaTaf: 'cfn',
      }) || ''
    ).trim();
  }
  return (c.notaNatacao ?? '').trim();
}

function notaCaminhadaVigenteNoCadastro(c: CadastroItemPersist): string {
  return (c.notaCaminhada ?? '').trim();
}

/** Resumo da aba Iniciar com base no Histórico de aplicações. */
export function calcularResumoInicioTafFromHistorico(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  sessoesExcluidas: SessaoAplicacaoTaf[] = [],
  nipsRestritosAtivos: Set<string> | ReadonlySet<string> = new Set(),
  /** @deprecated Contagem do card usa `nipsFatoresPreenchidos` (formulário completo). */
  nipsFatoresRisco: Set<string> | ReadonlySet<string> = new Set(),
  nipsFatoresPreenchidos: Set<string> | ReadonlySet<string> = new Set(),
): ResumoInicioTafHistorico {
  void nipsFatoresRisco;
  const cadastrosReais = cadastros.filter((c) => !isDemoCadastroId(c.id));
  const sessoesReais = sessoes.filter((s) => !isDemoSessaoId(s.id));
  const excluidasReais = sessoesExcluidas.filter((s) => !isDemoSessaoId(s.id));
  const unificadas = unificarSessoesComCadastroRegistrador(
    sessoesReais,
    cadastrosReais,
    excluidasReais,
  );
  const aggs = agregarHistoricoPorParticipante(unificadas, cadastrosReais);

  // Conta só cadastrados — evita inflar Parcial/Concluídos com sessões órfãs
  // (ex.: NIP sem cadastro) que deixam Pendente igual entre dispositivos e Parcial diferente.
  // Restritos (dispensa ativa): entram em `restritos`, não em pendente nem concluídos.
  const nipsRestritosNorm = new Set<string>();
  for (const n of nipsRestritosAtivos) {
    const key = nipChaveCadastro(n) || (nipDigitos(n).length === 8 ? nipDigitos(n) : '');
    if (key) nipsRestritosNorm.add(key);
  }
  const nipsFatoresPreenchidosNorm = new Set<string>();
  for (const n of nipsFatoresPreenchidos) {
    const key = nipChaveCadastro(n) || (nipDigitos(n).length === 8 ? nipDigitos(n) : '');
    if (key) nipsFatoresPreenchidosNorm.add(key);
  }

  let completos = 0;
  let parcial = 0;
  let semTeste = 0;
  let restritos = 0;
  let fatoresRisco = 0;
  let cadastroIncompleto = 0;
  let reprovados = 0;
  for (const c of cadastrosReais) {
    const nipC = nipChaveCadastro(c.nip);
    // Formulário completo (Sim/Não em todos) — com ou sem intercorrência/alerta.
    if (nipC && nipsFatoresPreenchidosNorm.has(nipC)) {
      fatoresRisco += 1;
    }
    if (cadastroIncompletoNascimentoOuFatores(c, nipsFatoresPreenchidosNorm)) {
      cadastroIncompleto += 1;
    }
    const agg = findAggRowForCadastro(aggs, c);
    // Só resultado vigente (última prova/cadastro) — aprovação posterior remove do card.
    if (modalidadesReprovadasDoCadastro(c, agg).length > 0) {
      reprovados += 1;
    }
    if (nipC && nipsRestritosNorm.has(nipC)) {
      restritos += 1;
      continue;
    }
    if (!agg) {
      semTeste += 1;
      continue;
    }
    const classe = classificarAggNoResumo(agg);
    if (classe === 'completo') completos += 1;
    else if (classe === 'parcial') parcial += 1;
    else semTeste += 1;
  }

  return {
    totalCadastrados: cadastrosReais.length,
    completos,
    parcial,
    semTeste,
    restritos,
    fatoresRisco,
    cadastroIncompleto,
    reprovados,
  };
}

export type ReprovadoInicioModalidade = {
  label: string;
  /** Chave estável para exclusão no cadastro/histórico (quando conhecida). */
  chave?: ModalidadeResultadoTaf;
  detalhe: string;
  /** Tempo da prova (MM:SS ou MM:SS:CS), quando conhecido. */
  tempo?: string;
  /**
   * Tempo máximo da norma para nota 50 (aprovação mínima), em MM:SS.
   * Permanência: duração exigida (10:00).
   */
  tempoMinimo?: string;
  /** Data do teste (DD/MM/AAAA), quando conhecida. */
  data?: string;
};

/** Converte o rótulo exibido (Corrida, Natação…) na chave de exclusão. */
export function modalidadeChaveFromLabelReprovado(
  label: string,
): ModalidadeResultadoTaf | null {
  const t = (label || '').trim().toLowerCase();
  if (t === 'corrida') return 'corrida';
  if (t === 'caminhada') return 'caminhada';
  if (t === 'natação' || t === 'natacao') return 'natacao';
  if (t === 'permanência' || t === 'permanencia') return 'permanencia';
  if (t.includes('barra')) return 'flexao_barra';
  if (t.includes('solo')) return 'flexao_solo';
  if (t.includes('remador')) return 'abdominal_remador';
  if (t.includes('prancha')) return 'abdominal_prancha';
  return null;
}

/** Texto de chip/coluna: `Corrida: REPROVADO · 12:34 · mín. 14:30 · 15/03/2026`. */
export function textoModalidadeReprovada(m: ReprovadoInicioModalidade): string {
  let s = `${m.label}: ${m.detalhe}`;
  if (m.tempo) s += ` · ${m.tempo}`;
  if (m.tempoMinimo) s += ` · mín. ${m.tempoMinimo}`;
  if (m.data) s += ` · ${m.data}`;
  return s;
}

function primeiroTempo(...vals: Array<string | null | undefined>): string | undefined {
  for (const v of vals) {
    const t = (v ?? '').trim();
    if (t) return t;
  }
  return undefined;
}

function cadastroSugereNormaCfn(c: CadastroItemPersist): boolean {
  return !!(
    c.notaFlexaoBarra ||
    c.notaFlexaoSolo ||
    c.notaAbdominalRemador ||
    c.notaAbdominalPrancha ||
    c.repsFlexaoBarra != null ||
    c.repsFlexaoSolo != null ||
    c.repsAbdominalRemador != null ||
    (c.tempoAbdominalPrancha ?? '').trim()
  );
}

/** Tempo necessário (limite nota 50 / duração permanência) para aprovação mínima. */
function tempoMinimoAprovacaoModalidade(
  label: string,
  c: CadastroItemPersist,
  normaCfn?: boolean,
): string | undefined {
  if (label === 'Permanência') return '10:00';
  const idade = idadeFromDataNascimento((c.dataNascimento ?? '').trim());
  if (idade == null) return undefined;
  const sexo = c.sexo;
  const cfn = normaCfn === true || (normaCfn !== false && cadastroSugereNormaCfn(c));
  if (label === 'Corrida') {
    return (
      (cfn
        ? tempoMaximoNota50Corrida3200(idade, sexo)
        : tempoMaximoNota50Corrida2400(idade, sexo)) ?? undefined
    );
  }
  if (label === 'Caminhada') {
    return tempoMaximoNota50Caminhada4800(idade, sexo) ?? undefined;
  }
  if (label === 'Natação') {
    return (
      (cfn
        ? tempoMaximoNota50Natacao100(idade, sexo)
        : tempoMaximoNota50Natacao(idade, sexo)) ?? undefined
    );
  }
  return undefined;
}

export type ReprovadoInicioTafItem = {
  id: string;
  nip: string;
  nome: string;
  postoGrad: string;
  categoria: string;
  modalidades: ReprovadoInicioModalidade[];
};

/** Normaliza data de cadastro/sessão para DD/MM/AAAA. */
export function formatDataTesteReprovado(raw?: string | null): string | undefined {
  const t = (raw || '').trim();
  if (!t) return undefined;
  const br = t.match(/^(\d{2}\/\d{2}\/\d{4})/);
  if (br) return br[1];
  const isoDay = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[3]}/${isoDay[2]}/${isoDay[1]}`;
  const d = new Date(t);
  if (!Number.isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return undefined;
}

function detalheModalidade(m?: ModalidadeHistorico): string {
  if (!m) return 'Reprovado';
  const sit = (m.situacao || '').trim();
  const nota = (m.nota || '').trim();
  if (sit && sit !== '—') return sit;
  if (nota && nota !== '—') return nota;
  return 'Reprovado';
}

function pushModalidadeUnica(
  list: ReprovadoInicioModalidade[],
  label: string,
  detalhe: string,
  data?: string,
  tempo?: string,
  tempoMinimo?: string,
  chave?: ModalidadeResultadoTaf | null,
): void {
  const dataNorm = formatDataTesteReprovado(data);
  const tempoNorm = (tempo ?? '').trim() || undefined;
  const tempoMinNorm = (tempoMinimo ?? '').trim() || undefined;
  const chaveNorm = chave ?? modalidadeChaveFromLabelReprovado(label) ?? undefined;
  const existing = list.find((m) => m.label === label);
  if (existing) {
    if (!existing.data && dataNorm) existing.data = dataNorm;
    if (!existing.tempo && tempoNorm) existing.tempo = tempoNorm;
    if (!existing.tempoMinimo && tempoMinNorm) existing.tempoMinimo = tempoMinNorm;
    if (!existing.chave && chaveNorm) existing.chave = chaveNorm;
    return;
  }
  list.push({
    label,
    detalhe: detalhe.trim() || 'Reprovado',
    ...(chaveNorm ? { chave: chaveNorm } : {}),
    ...(tempoNorm ? { tempo: tempoNorm } : {}),
    ...(tempoMinNorm ? { tempoMinimo: tempoMinNorm } : {}),
    ...(dataNorm ? { data: dataNorm } : {}),
  });
}

function modalidadesReprovadasDoCadastro(
  c: CadastroItemPersist,
  agg: AggRow | undefined,
): ReprovadoInicioModalidade[] {
  const out: ReprovadoInicioModalidade[] = [];

  const notaCorridaCad = notaCorridaVigenteNoCadastro(c);
  if (
    modalidadeVigenteReprovada(
      {
        ativo: temAvaliacaoCorrida(c),
        reprovado: isNotaReprovacaoTexto(notaCorridaCad),
        data: c.dataTafCorrida,
      },
      {
        ativo: !!agg?.corrida,
        reprovado: !!agg?.corrida && modalidadeEhReprovada(agg.corrida),
        data: agg?.corridaSessaoEm || c.dataTafCorrida,
      },
    )
  ) {
    const doAgg = !!agg?.corrida && modalidadeEhReprovada(agg.corrida);
    pushModalidadeUnica(
      out,
      'Corrida',
      doAgg
        ? detalheModalidade(agg!.corrida!)
        : notaCorridaCad || 'Reprovado',
      c.dataTafCorrida || agg?.corridaSessaoEm,
      primeiroTempo(agg?.corrida?.tempo, c.tempoCorrida),
      undefined,
      'corrida',
    );
  }

  const notaCamCad = notaCaminhadaVigenteNoCadastro(c);
  if (
    modalidadeVigenteReprovada(
      {
        ativo: temAvaliacaoCaminhada(c),
        reprovado: isNotaReprovacaoTexto(notaCamCad),
        data: c.dataTafCaminhada,
      },
      {
        ativo: !!agg?.caminhada,
        reprovado: !!agg?.caminhada && modalidadeEhReprovada(agg.caminhada),
        data: agg?.caminhadaSessaoEm || c.dataTafCaminhada,
      },
    )
  ) {
    const doAgg = !!agg?.caminhada && modalidadeEhReprovada(agg.caminhada);
    pushModalidadeUnica(
      out,
      'Caminhada',
      doAgg
        ? detalheModalidade(agg!.caminhada!)
        : notaCamCad || 'Reprovado',
      c.dataTafCaminhada || agg?.caminhadaSessaoEm,
      primeiroTempo(agg?.caminhada?.tempo, c.tempoCaminhada),
      undefined,
      'caminhada',
    );
  }

  const notaNatCad = notaNatacaoVigenteNoCadastro(c);
  const natCadRep =
    isNotaReprovacaoTexto(notaNatCad) || c.resultadoNatacao === 'reprovado';
  if (
    modalidadeVigenteReprovada(
      {
        ativo: temAvaliacaoNatacao(c),
        reprovado: natCadRep,
        data: c.dataTafNatacao,
      },
      {
        ativo: !!agg?.natacao,
        reprovado: !!agg?.natacao && modalidadeEhReprovada(agg.natacao),
        data: agg?.natacaoSessaoEm || c.dataTafNatacao,
      },
    )
  ) {
    const doAgg = !!agg?.natacao && modalidadeEhReprovada(agg.natacao);
    pushModalidadeUnica(
      out,
      'Natação',
      doAgg
        ? detalheModalidade(agg!.natacao!)
        : notaNatCad || 'Reprovado',
      c.dataTafNatacao || agg?.natacaoSessaoEm,
      primeiroTempo(agg?.natacao?.tempo, c.tempoNatacao),
      undefined,
      'natacao',
    );
  }

  const permCadRep = c.resultadoPermanencia === 'reprovado';
  if (
    modalidadeVigenteReprovada(
      {
        ativo: temAvaliacaoPermanencia(c),
        reprovado: permCadRep,
        data: c.dataTafPermanencia,
      },
      {
        ativo: !!agg?.permanencia,
        reprovado: !!agg?.permanencia && modalidadeEhReprovada(agg.permanencia),
        data: agg?.permanenciaSessaoEm || c.dataTafPermanencia,
      },
    )
  ) {
    const doAgg = !!agg?.permanencia && modalidadeEhReprovada(agg.permanencia);
    pushModalidadeUnica(
      out,
      'Permanência',
      doAgg ? detalheModalidade(agg!.permanencia!) : 'Reprovado',
      c.dataTafPermanencia || agg?.permanenciaSessaoEm,
      primeiroTempo(agg?.permanencia?.tempo, c.tempoPermanencia),
      undefined,
      'permanencia',
    );
  }

  const cfnMods: Array<{
    label: string;
    chave: ModalidadeResultadoTaf;
    notaCad: string | undefined;
    aggMod?: ModalidadeHistorico;
  }> = [
    {
      label: 'Flexão de Barra',
      chave: 'flexao_barra',
      notaCad: c.notaFlexaoBarra,
      aggMod: agg?.flexaoBarra,
    },
    {
      label: 'Flexão de Solo',
      chave: 'flexao_solo',
      notaCad: c.notaFlexaoSolo,
      aggMod: agg?.flexaoSolo,
    },
    {
      label: 'Abdominal Remador',
      chave: 'abdominal_remador',
      notaCad: c.notaAbdominalRemador,
      aggMod: agg?.abdominalRemador,
    },
    {
      label: 'Abdominal Prancha',
      chave: 'abdominal_prancha',
      notaCad: c.notaAbdominalPrancha,
      aggMod: agg?.abdominalPrancha,
    },
  ];
  for (const m of cfnMods) {
    const nota = (m.notaCad ?? '').trim();
    const temCad = !!nota || (m.chave === 'abdominal_prancha' && !!(c.tempoAbdominalPrancha ?? '').trim());
    if (
      modalidadeVigenteReprovada(
        {
          ativo: temCad,
          reprovado: isNotaReprovacaoTexto(nota),
        },
        {
          ativo: !!m.aggMod,
          reprovado: !!m.aggMod && modalidadeEhReprovada(m.aggMod),
        },
      )
    ) {
      const doAgg = !!m.aggMod && modalidadeEhReprovada(m.aggMod);
      pushModalidadeUnica(
        out,
        m.label,
        doAgg ? detalheModalidade(m.aggMod!) : nota || 'Reprovado',
        undefined,
        m.aggMod?.tempo,
        undefined,
        m.chave,
      );
    }
  }

  return out;
}

function sessaoCfnParaModalidade(
  label: string,
  sessoes: SessaoAplicacaoTaf[],
  c: CadastroItemPersist,
  index: CadastroLookupIndex,
  cadastros: CadastroItemPersist[],
): boolean {
  // Militar explicitamente cadastrado como CFN — suas provas de corrida/natação
  // são sempre avaliadas pelas tabelas CFN (3200 m / 100 m).
  if (c.normaTaf === 'cfn' && (label === 'Corrida' || label === 'Natação')) return true;

  // Modalidades exclusivas do CFN são sempre norma CFN.
  if (
    label === 'Flexão de Barra' ||
    label === 'Flexão de Solo' ||
    label === 'Abdominal Remador' ||
    label === 'Abdominal Prancha'
  ) return true;

  const tipo =
    label === 'Natação'
      ? 'natacao'
      : label === 'Permanência'
        ? 'permanencia'
        : label === 'Caminhada'
          ? 'caminhada'
          : label === 'Corrida'
            ? 'corrida'
            : null;
  if (!tipo) return false;
  const nipC = nipDigitos(c.nip);
  for (const sessao of sessoes) {
    if (sessao.tipoProva !== tipo || sessao.normaTaf !== 'cfn') continue;
    for (const r of sessao.resultados ?? []) {
      const busca = buscarCadastroIndexed(
        index,
        cadastros,
        (r.nip ?? '').trim() || (r.nome ?? '').trim(),
      );
      const match =
        (busca.kind === 'found' && busca.cadastro.id === c.id) ||
        (nipC.length >= 8 && nipDigitos(r.nip ?? '') === nipC);
      if (match) return true;
    }
  }
  return false;
}

/**
 * Lista detalhada dos cadastrados reprovados em pelo menos um teste
 * (mesmo critério do card Reprovados na aba Iniciar).
 */
export function montarListaReprovadosInicioTaf(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  sessoesExcluidas: SessaoAplicacaoTaf[] = [],
): ReprovadoInicioTafItem[] {
  const cadastrosReais = cadastros.filter((c) => !isDemoCadastroId(c.id));
  const sessoesReais = sessoes.filter((s) => !isDemoSessaoId(s.id));
  const excluidasReais = sessoesExcluidas.filter((s) => !isDemoSessaoId(s.id));
  const unificadas = unificarSessoesComCadastroRegistrador(
    sessoesReais,
    cadastrosReais,
    excluidasReais,
  );
  const aggs = agregarHistoricoPorParticipante(unificadas, cadastrosReais);
  const index = buildCadastroLookupIndex(cadastrosReais);

  const lista: ReprovadoInicioTafItem[] = [];
  for (const c of cadastrosReais) {
    const agg = findAggRowForCadastro(aggs, c);
    const modalidades: ReprovadoInicioModalidade[] = [];
    for (const m of modalidadesReprovadasDoCadastro(c, agg)) {
      pushModalidadeUnica(modalidades, m.label, m.detalhe, m.data, m.tempo, m.tempoMinimo, m.chave);
    }
    if (modalidades.length === 0) continue;
    for (const m of modalidades) {
      const cfn = sessaoCfnParaModalidade(m.label, unificadas, c, index, cadastrosReais);
      const minimo = tempoMinimoAprovacaoModalidade(m.label, c, cfn);
      if (minimo) m.tempoMinimo = minimo;
    }

    const postoBase =
      c.categoria === 'Oficiais'
        ? (c.oficial || '').trim()
        : c.categoria === 'Praças'
          ? (c.praca || '').trim()
          : (c.oficial || c.praca || '').trim();

    lista.push({
      id: c.id,
      nip: formatNipInput(c.nip) || c.nip || '—',
      nome: (c.nome || '').trim() || '—',
      postoGrad: postoGradComVinculo(postoBase, c.vinculo) || '—',
      categoria: c.categoria || '—',
      modalidades,
    });
  }

  lista.sort(compareByNomePtBr);
  return lista;
}
