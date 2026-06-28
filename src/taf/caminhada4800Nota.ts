/**
 * Notas da prova de caminhada (4.800 m) — tabelas feminina e masculina.
 * Faixas etárias e tempos máximos (minutos inteiros) conforme norma TAF:
 * notas 50, 60, 70, 80, 90, 100 — tempo de término <= limite → nota correspondente.
 */

import { tempoStringParaMsProva } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import {
  faixaEtariaCorrida2400,
  sexoTabelaCorrida2400,
  type FaixaEtariaCorrida2400,
} from './corrida2400Nota';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

/** Converte minutos inteiros da norma em segundos. */
function minutosParaSegundos(min: number): number {
  return min * 60;
}

/**
 * Linha da norma: tempos na ordem 50, 60, 70, 80, 90, 100 (minutos) →
 * limites internos na ordem 100, 90, 80, 70, 60, 50 (segundos).
 */
function limitesCaminhadaPorNota(
  t50: number,
  t60: number,
  t70: number,
  t80: number,
  t90: number,
  t100: number,
): readonly number[] {
  return [t100, t90, t80, t70, t60, t50].map(minutosParaSegundos) as readonly number[];
}

/** Masculino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const M_18_25 = limitesCaminhadaPorNota(48, 46, 44, 42, 40, 38);
const M_26_33 = limitesCaminhadaPorNota(49, 47, 45, 43, 41, 39);
const M_34_39 = limitesCaminhadaPorNota(51, 48, 46, 44, 42, 40);
const M_40_45 = limitesCaminhadaPorNota(54, 51, 48, 46, 44, 42);
const M_46_49 = limitesCaminhadaPorNota(56, 53, 50, 47, 45, 43);
const M_ACIMA_50 = limitesCaminhadaPorNota(58, 55, 52, 49, 47, 45);

/** Feminino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const F_18_25 = limitesCaminhadaPorNota(49, 47, 45, 43, 41, 39);
const F_26_33 = limitesCaminhadaPorNota(51, 48, 46, 44, 42, 40);
const F_34_39 = limitesCaminhadaPorNota(54, 51, 48, 46, 44, 42);
const F_40_45 = limitesCaminhadaPorNota(56, 53, 50, 47, 45, 43);
const F_46_49 = limitesCaminhadaPorNota(58, 55, 52, 49, 47, 45);
const F_ACIMA_50 = limitesCaminhadaPorNota(60, 57, 54, 51, 49, 47);

const FAIXA_TABELA_M: Record<FaixaEtariaCorrida2400, readonly number[]> = {
  '18-25': M_18_25,
  '26-33': M_26_33,
  '34-39': M_34_39,
  '40-45': M_40_45,
  '46-49': M_46_49,
  '50+': M_ACIMA_50,
};

const FAIXA_TABELA_F: Record<FaixaEtariaCorrida2400, readonly number[]> = {
  '18-25': F_18_25,
  '26-33': F_26_33,
  '34-39': F_34_39,
  '40-45': F_40_45,
  '46-49': F_46_49,
  '50+': F_ACIMA_50,
};

function tabelaCaminhada4800(sexo: 'M' | 'F' | undefined): Record<FaixaEtariaCorrida2400, readonly number[]> {
  return sexoTabelaCorrida2400(sexo) === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M;
}

export type NotaCaminhada4800Result =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

export function notaCaminhada4800(
  tempoMs: number,
  idadeAnos: number,
  sexo?: 'M' | 'F',
): NotaCaminhada4800Result {
  const faixa = faixaEtariaCorrida2400(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = tabelaCaminhada4800(sexo)[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

export function textoNotaCaminhada(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';

  const r = notaCaminhada4800(tempoMs, idadeAnos, sexoTabelaCorrida2400(sexo));
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

export function notaCaminhadaParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

export function textoNotaCaminhadaFromCadastro(input: {
  tempoCaminhada?: string | null;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F';
  refDate?: Date;
}): string {
  const tempo = (input.tempoCaminhada ?? '').trim();
  if (!tempo) return '—';
  const tempoMs = tempoStringParaMsProva(tempo);
  if (tempoMs == null) return '—';
  const idade = idadeFromDataNascimento((input.dataNascimento ?? '').trim(), input.refDate);
  return textoNotaCaminhada(tempoMs, idade, input.sexo);
}
