/**
 * Notas da natação 100 m — Fuzileiros Navais (CGCFN-108 § 5.5.2).
 */

import { tempoStringParaSegundos } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { parseTafPerformanceInput } from './tafTimeFormat';
import { faixaEtariaNatacao, type FaixaEtariaNatacao } from './natacaoNota';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

function mmssParaSegundos(mmss: string): number {
  const sec = tempoStringParaSegundos(mmss);
  if (sec == null) throw new Error(`Tempo inválido na norma de natação 100 m: ${mmss}`);
  return sec;
}

function limitesNatacaoPorNota(
  t50: string,
  t60: string,
  t70: string,
  t80: string,
  t90: string,
  t100: string,
): readonly number[] {
  return [t100, t90, t80, t70, t60, t50].map(mmssParaSegundos) as readonly number[];
}

const M_18_30 = limitesNatacaoPorNota('03:20', '03:00', '02:40', '02:20', '02:00', '01:40');
const M_31_40 = limitesNatacaoPorNota('03:30', '03:10', '02:50', '02:30', '02:10', '01:50');
const M_41_49 = limitesNatacaoPorNota('03:40', '03:20', '03:00', '02:40', '02:20', '02:00');
const M_ACIMA_50 = limitesNatacaoPorNota('03:50', '03:30', '03:10', '02:50', '02:30', '02:10');

const F_18_30 = limitesNatacaoPorNota('04:00', '03:40', '03:20', '03:00', '02:40', '02:20');
const F_31_40 = limitesNatacaoPorNota('04:10', '03:50', '03:30', '03:10', '02:50', '02:30');
const F_41_49 = limitesNatacaoPorNota('04:20', '04:00', '03:40', '03:20', '03:00', '02:40');
const F_ACIMA_50 = limitesNatacaoPorNota('04:30', '04:10', '03:50', '03:30', '03:10', '02:50');

const FAIXA_TABELA_M: Record<FaixaEtariaNatacao, readonly number[]> = {
  '18-30': M_18_30,
  '31-40': M_31_40,
  '41-49': M_41_49,
  '50+': M_ACIMA_50,
};

const FAIXA_TABELA_F: Record<FaixaEtariaNatacao, readonly number[]> = {
  '18-30': F_18_30,
  '31-40': F_31_40,
  '41-49': F_41_49,
  '50+': F_ACIMA_50,
};

export type NotaNatacao100Result =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

export function notaNatacao100(
  tempoMs: number,
  idadeAnos: number,
  sexo: 'M' | 'F' | undefined,
): NotaNatacao100Result {
  const faixa = faixaEtariaNatacao(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = (sexo === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M)[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

export function textoNotaNatacao100(
  tempoMs: number,
  idadeAnos: number | null,
  sexo: 'M' | 'F' | undefined,
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';
  const r = notaNatacao100(tempoMs, idadeAnos, sexo);
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

export function notaNatacao100ParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

export function textoNotaNatacao100FromCadastro(input: {
  tempoNatacao?: string | null;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F';
  refDate?: Date;
}): string {
  const tempo = (input.tempoNatacao ?? '').trim();
  if (!tempo) return '—';
  const tempoMs = parseTafPerformanceInput('natacao', tempo);
  if (tempoMs == null) return '—';
  const idade = idadeFromDataNascimento((input.dataNascimento ?? '').trim(), input.refDate);
  return textoNotaNatacao100(tempoMs, idade, input.sexo);
}
