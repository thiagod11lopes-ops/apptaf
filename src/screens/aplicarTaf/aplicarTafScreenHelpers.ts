import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../../navigation/types';
import type { TipoProvaTAF } from '../../taf/tafProvaTypes';
import { tituloProvaTaf } from '../../taf/tafProvaTypes';
import {
  MAX_PRE_CADASTRO_PARTICIPANTES,
  type PreCadastroTaf,
} from '../../services/preCadastroTafStorage';
import { formatNomeComPosto } from '../../utils/formatNomeComPosto';
import { isNotaReprovacaoTexto } from '../../utils/notaReprovacaoTexto';

/** Máscara NIP: 00.0000.00 (igual ao cadastro) */
export function formatNipInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 6);
  const c = digits.slice(6, 8);
  if (digits.length <= 2) return a;
  if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
  return `${a}.${b}.${c}`;
}

export const MAX_PARTICIPANTES = 200;

/** Prefill do número de voltas em corrida/caminhada. */
export const NUMERO_VOLTAS_PADRAO = '6';

/** Duração da prova de permanência — ao atingir, exibe modal de finalização. */
export const PERMANENCIA_DURACAO_MS = 10 * 60 * 1000;

export type CorridaEtapa =
  | 'menu'
  | 'nips'
  | 'tabela_corrida'
  | 'tabela_permanencia'
  | 'tabela_repeticoes';

export function trialTipoFromProva(tipo: TipoProvaTAF): 'corrida' | 'natacao' | 'caminhada' {
  if (tipo === 'natacao' || tipo === 'abdominal_prancha') return 'natacao';
  if (tipo === 'caminhada') return 'caminhada';
  return 'corrida';
}

/** Pré-cadastro e identificação direta: caminhada usa 200; demais provas com cronômetro, 20. */
export function limiteParticipantesPreCadastro(tipo: TipoProvaTAF | null): number {
  if (tipo === 'caminhada') return MAX_PARTICIPANTES;
  return MAX_PRE_CADASTRO_PARTICIPANTES;
}

/** Campos de cadastro usados no feedback NIP e no modal de edição. */
export function camposCadastroParaFeedback(c: CadastroItemPersist) {
  const nomeBare = (c.nome || '').trim() || 'Sem nome';
  return {
    nomeMilitar: formatNomeComPosto({ ...c, nome: nomeBare }),
    nome: nomeBare,
    categoria: c.categoria === 'Oficiais' ? ('Oficiais' as const) : ('Praças' as const),
    oficial: c.oficial,
    praca: c.praca,
    dataNascimento: (c.dataNascimento || '').trim(),
    sexo: c.sexo,
    vinculo: c.vinculo === 'carreira' || c.vinculo === 'rm2' ? c.vinculo : undefined,
  };
}

export const MAX_VOLTAS_COLUNAS = 99;

export function labelTipoProvaPreCadastro(pre: PreCadastroTaf): string {
  const norma = pre.normaTaf ?? 'armada';
  const titulo = tituloProvaTaf(pre.tipoProva, norma === 'cfn');
  return norma === 'cfn' ? `CFN · ${titulo}` : titulo;
}

export function metaPreCadastro(pre: PreCadastroTaf): string {
  const norma = pre.normaTaf === 'cfn' ? 'CFN' : 'Armada';
  const qtd = pre.participantes.length;
  return `${norma} · ${qtd} participante${qtd !== 1 ? 's' : ''} · ${formatarDataPreCadastro(pre.criadoEm)}`;
}

export function formatarDataPreCadastro(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export type RubricaPoint = { x: number; y: number };
export type RubricaStroke = RubricaPoint[];

export function buildStrokePath(points: RubricaPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }
  return points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

export function buildRubricaSvgDataUrl(
  strokes: RubricaStroke[],
  width: number,
  height: number,
  strokeColor: string,
  bgColor: string,
): string {
  const paths = strokes
    .filter((s) => s.length > 0)
    .map(
      (s) =>
        `<path d="${buildStrokePath(s)}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  const safeWidth = Math.max(1, Math.round(width));
  const safeHeight = Math.max(1, Math.round(height));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}"><rect width="100%" height="100%" fill="${bgColor}"/>${paths}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Situação no modal de rúbrica — corrida e natação (alinhada ao PDF). */
export function textoSituacaoRubricaModal(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto) return r.reprovacaoTexto;
  if (r.desistencia || isNotaReprovacaoTexto(r.notaTexto)) return 'Reprovado';
  if (r.notaTexto != null && r.notaTexto !== '') return 'Aprovado';
  return '—';
}

export function textoNotaRubricaModal(r: ResultadoCorridaItem): string {
  const t = r.notaTexto ?? r.noraTexto;
  if (t == null || t === '') return '—';
  return t;
}
