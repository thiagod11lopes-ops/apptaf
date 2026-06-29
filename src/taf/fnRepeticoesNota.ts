/**
 * Notas por repetições — Fuzileiros Navais (flexões e abdominal remador).
 */

import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { faixaEtariaFn, type FaixaEtariaFn } from './fnFaixaEtaria';
import type { TipoProvaTAF } from './tafProvaTypes';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

export type NotaRepeticoesResult =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

function parseMinReps(cell: string): number {
  const t = cell.trim();
  if (t.includes('/')) {
    return parseInt(t.split('/')[0]!, 10);
  }
  return parseInt(t, 10);
}

function linhaReps(...cells: string[]): readonly number[] {
  const [t50, t60, t70, t80, t90, t100] = cells;
  return [t100, t90, t80, t70, t60, t50].map(parseMinReps) as readonly number[];
}

type TabelaReps = Record<FaixaEtariaFn, readonly number[]>;

const FLEXAO_BARRA_M: TabelaReps = {
  '18-25': linhaReps('7', '8', '9/10', '11/12', '13/14', '15'),
  '26-33': linhaReps('6', '7', '8', '9/10', '11/12', '13'),
  '34-39': linhaReps('5', '6', '7', '8', '9/10', '11'),
  '40-45': linhaReps('4', '5', '6', '7', '8/9', '10'),
  '46-49': linhaReps('3', '4', '5', '6', '7', '8'),
  '50-54': linhaReps('2', '3', '4', '5', '6', '7'),
  '55-60': linhaReps('1', '2', '3', '4', '5', '6'),
};

const FLEXAO_SOLO_M: TabelaReps = {
  '18-25': linhaReps('28', '32', '36', '40', '44', '48'),
  '26-33': linhaReps('24', '28', '32', '36', '40', '44'),
  '34-39': linhaReps('20', '24', '28', '32', '36', '40'),
  '40-45': linhaReps('16', '20', '24', '28', '32', '36'),
  '46-49': linhaReps('12', '16', '20', '24', '28', '32'),
  '50-54': linhaReps('8', '12', '16', '20', '24', '28'),
  '55-60': linhaReps('4', '8', '12', '16', '20', '24'),
};

const FLEXAO_SOLO_F: TabelaReps = {
  '18-25': linhaReps('24', '27', '30', '33', '36', '39'),
  '26-33': linhaReps('21', '24', '27', '30', '33', '36'),
  '34-39': linhaReps('15', '18', '21', '24', '27', '30'),
  '40-45': linhaReps('12', '15', '18', '21', '24', '27'),
  '46-49': linhaReps('9', '12', '15', '18', '21', '24'),
  '50-54': linhaReps('6', '9', '12', '15', '18', '21'),
  '55-60': linhaReps('3', '6', '9', '12', '15', '18'),
};

const ABDOMINAL_REMADOR_M: TabelaReps = {
  '18-25': linhaReps('30', '34', '38', '42', '46', '50'),
  '26-33': linhaReps('27', '31', '35', '39', '43', '47'),
  '34-39': linhaReps('24', '28', '32', '36', '40', '44'),
  '40-45': linhaReps('21', '25', '29', '33', '37', '41'),
  '46-49': linhaReps('18', '22', '26', '30', '34', '38'),
  '50-54': linhaReps('15', '19', '23', '27', '31', '35'),
  '55-60': linhaReps('12', '16', '20', '24', '28', '32'),
};

const ABDOMINAL_REMADOR_F: TabelaReps = {
  '18-25': linhaReps('26', '30', '34', '38', '42', '46'),
  '26-33': linhaReps('23', '27', '31', '35', '39', '43'),
  '34-39': linhaReps('20', '24', '28', '32', '36', '40'),
  '40-45': linhaReps('17', '21', '25', '29', '33', '37'),
  '46-49': linhaReps('14', '18', '22', '26', '30', '34'),
  '50-54': linhaReps('11', '15', '19', '23', '27', '31'),
  '55-60': linhaReps('8', '12', '16', '20', '24', '28'),
};

function tabelaReps(
  prova: 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
  sexo?: 'M' | 'F',
): TabelaReps | null {
  if (prova === 'flexao_barra') {
    return sexo === 'F' ? null : FLEXAO_BARRA_M;
  }
  if (prova === 'flexao_solo') {
    return sexo === 'F' ? FLEXAO_SOLO_F : FLEXAO_SOLO_M;
  }
  return sexo === 'F' ? ABDOMINAL_REMADOR_F : ABDOMINAL_REMADOR_M;
}

export function notaPorRepeticoes(
  prova: 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
  repeticoes: number,
  idadeAnos: number,
  sexo?: 'M' | 'F',
): NotaRepeticoesResult {
  const faixa = faixaEtariaFn(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };
  if (!Number.isFinite(repeticoes) || repeticoes < 0) return { kind: 'reprovado' };

  const tabela = tabelaReps(prova, sexo);
  if (!tabela) return { kind: 'fora_tabela' };

  const limites = tabela[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (repeticoes >= limites[i]!) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

export function textoNotaPorRepeticoes(
  prova: 'flexao_barra' | 'flexao_solo' | 'abdominal_remador',
  repeticoes: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';
  const r = notaPorRepeticoes(prova, repeticoes, idadeAnos, sexo);
  if (r.kind === 'fora_tabela') {
    if (prova === 'flexao_barra' && sexo === 'F') return '—';
    return '—';
  }
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

export function notaRepeticoesParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

export function textoNotaRepeticoesFromCadastro(input: {
  prova: 'flexao_barra' | 'flexao_solo' | 'abdominal_remador';
  repeticoes?: number | null;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F';
  refDate?: Date;
}): string {
  if (input.repeticoes == null || !Number.isFinite(input.repeticoes)) return '—';
  const idade = idadeFromDataNascimento((input.dataNascimento ?? '').trim(), input.refDate);
  return textoNotaPorRepeticoes(input.prova, input.repeticoes, idade, input.sexo);
}

export function isProvaRepeticoesFn(
  tipo: TipoProvaTAF | null,
): tipo is 'flexao_barra' | 'flexao_solo' | 'abdominal_remador' {
  return tipo === 'flexao_barra' || tipo === 'flexao_solo' || tipo === 'abdominal_remador';
}
