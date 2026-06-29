/**
 * Notas do abdominal em prancha frontal — Fuzileiros Navais.
 * Quanto maior o tempo sustentado, melhor a nota.
 */

import { tempoStringParaSegundos } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { parseTafPerformanceInput } from './tafTimeFormat';
import { faixaEtariaFn, type FaixaEtariaFn } from './fnFaixaEtaria';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

function mmssParaSegundos(mmss: string): number {
  const sec = tempoStringParaSegundos(mmss);
  if (sec == null) throw new Error(`Tempo inválido na norma de prancha: ${mmss}`);
  return sec;
}

function limitesPranchaPorNota(
  t50: string,
  t60: string,
  t70: string,
  t80: string,
  t90: string,
  t100: string,
): readonly number[] {
  return [t100, t90, t80, t70, t60, t50].map(mmssParaSegundos) as readonly number[];
}

const M_18_25 = limitesPranchaPorNota('2:15', '2:30', '2:45', '3:00', '3:15', '3:30');
const M_26_33 = limitesPranchaPorNota('2:05', '2:20', '2:35', '2:50', '3:05', '3:20');
const M_34_39 = limitesPranchaPorNota('1:55', '2:10', '2:25', '2:40', '2:55', '3:10');
const M_40_45 = limitesPranchaPorNota('1:45', '2:00', '2:15', '2:30', '2:45', '3:00');
const M_46_49 = limitesPranchaPorNota('1:35', '1:50', '2:05', '2:20', '2:35', '2:50');
const M_50_54 = limitesPranchaPorNota('1:25', '1:40', '1:55', '2:10', '2:25', '2:40');
const M_55_60 = limitesPranchaPorNota('1:15', '1:30', '1:45', '2:00', '2:15', '2:30');

const F_18_25 = limitesPranchaPorNota('1:55', '2:10', '2:25', '2:40', '2:55', '3:10');
const F_26_33 = limitesPranchaPorNota('1:45', '2:00', '2:15', '2:30', '2:45', '3:00');
const F_34_39 = limitesPranchaPorNota('1:35', '1:50', '2:05', '2:20', '2:35', '2:50');
const F_40_45 = limitesPranchaPorNota('1:25', '1:40', '1:55', '2:10', '2:25', '2:40');
const F_46_49 = limitesPranchaPorNota('1:15', '1:30', '1:45', '2:00', '2:15', '2:30');
const F_50_54 = limitesPranchaPorNota('1:05', '1:20', '1:35', '1:50', '2:05', '2:20');
const F_55_60 = limitesPranchaPorNota('0:55', '1:10', '1:25', '1:40', '1:55', '2:10');

const FAIXA_TABELA_M: Record<FaixaEtariaFn, readonly number[]> = {
  '18-25': M_18_25,
  '26-33': M_26_33,
  '34-39': M_34_39,
  '40-45': M_40_45,
  '46-49': M_46_49,
  '50-54': M_50_54,
  '55-60': M_55_60,
};

const FAIXA_TABELA_F: Record<FaixaEtariaFn, readonly number[]> = {
  '18-25': F_18_25,
  '26-33': F_26_33,
  '34-39': F_34_39,
  '40-45': F_40_45,
  '46-49': F_46_49,
  '50-54': F_50_54,
  '55-60': F_55_60,
};

export type NotaAbdominalPranchaResult =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

export function notaAbdominalPrancha(
  tempoMs: number,
  idadeAnos: number,
  sexo?: 'M' | 'F',
): NotaAbdominalPranchaResult {
  const faixa = faixaEtariaFn(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = (sexo === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M)[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec >= limites[i]!) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

export function textoNotaAbdominalPrancha(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';
  const r = notaAbdominalPrancha(tempoMs, idadeAnos, sexo);
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

export function notaAbdominalPranchaParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

export function textoNotaAbdominalPranchaFromCadastro(input: {
  tempoAbdominalPrancha?: string | null;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F';
  refDate?: Date;
}): string {
  const tempo = (input.tempoAbdominalPrancha ?? '').trim();
  if (!tempo) return '—';
  const tempoMs = parseTafPerformanceInput('natacao', tempo);
  if (tempoMs == null) return '—';
  const idade = idadeFromDataNascimento((input.dataNascimento ?? '').trim(), input.refDate);
  return textoNotaAbdominalPrancha(tempoMs, idade, input.sexo);
}
