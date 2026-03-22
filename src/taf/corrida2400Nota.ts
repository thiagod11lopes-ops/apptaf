/**
 * Notas da prova de corrida (2400 m) — feminino e masculino.
 * Faixas etárias 18–50 anos; notas 50 a 100 pontos.
 *
 * Os limites em segundos coincidem com a norma (faixas "até" / "acima de X até Y"
 * produzem a mesma classificação que: o primeiro limite superior ≥ tempo define a nota).
 */

/** Limites em segundos [100, 90, 80, 70, 60, 50] — tempo <= limite → nota correspondente. */
const TABELA_18_25 = [9 * 60 + 36, 10 * 60 + 12, 11 * 60 + 18, 12 * 60 + 18, 13 * 60 + 30, 14 * 60 + 30] as const;
const TABELA_26_30 = [9 * 60 + 48, 10 * 60 + 24, 11 * 60 + 30, 12 * 60 + 30, 13 * 60 + 42, 14 * 60 + 42] as const;
const TABELA_31_35 = [10 * 60, 10 * 60 + 36, 11 * 60 + 42, 12 * 60 + 42, 13 * 60 + 54, 14 * 60 + 54] as const;
const TABELA_36_40 = [10 * 60 + 12, 10 * 60 + 48, 11 * 60 + 54, 12 * 60 + 54, 14 * 60 + 6, 15 * 60 + 6] as const;
const TABELA_41_45 = [10 * 60 + 24, 11 * 60, 12 * 60 + 6, 13 * 60 + 6, 14 * 60 + 18, 15 * 60 + 18] as const;
const TABELA_46_50 = [10 * 60 + 36, 11 * 60 + 12, 12 * 60 + 18, 13 * 60 + 18, 14 * 60 + 30, 15 * 60 + 30] as const;

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

export type FaixaEtariaCorrida2400 =
  | '18-25'
  | '26-30'
  | '31-35'
  | '36-40'
  | '41-45'
  | '46-50';

const FAIXA_TABELA: Record<FaixaEtariaCorrida2400, readonly number[]> = {
  '18-25': TABELA_18_25,
  '26-30': TABELA_26_30,
  '31-35': TABELA_31_35,
  '36-40': TABELA_36_40,
  '41-45': TABELA_41_45,
  '46-50': TABELA_46_50,
};

/** @deprecated Use faixaEtariaCorrida2400 */
export function faixaEtariaCorridaMasculina(idadeAnos: number): FaixaEtariaCorrida2400 | null {
  return faixaEtariaCorrida2400(idadeAnos);
}

/**
 * Faixa etária para tabelas de corrida 2400 m (18 a 50 anos).
 * Fora desse intervalo retorna null.
 */
export function faixaEtariaCorrida2400(idadeAnos: number): FaixaEtariaCorrida2400 | null {
  if (idadeAnos >= 18 && idadeAnos <= 25) return '18-25';
  if (idadeAnos >= 26 && idadeAnos <= 30) return '26-30';
  if (idadeAnos >= 31 && idadeAnos <= 35) return '31-35';
  if (idadeAnos >= 36 && idadeAnos <= 40) return '36-40';
  if (idadeAnos >= 41 && idadeAnos <= 45) return '41-45';
  if (idadeAnos >= 46 && idadeAnos <= 50) return '46-50';
  return null;
}

export type NotaCorrida2400Result =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

/** @deprecated Use notaCorrida2400 */
export type NotaCorridaMasculinaResult = NotaCorrida2400Result;

/**
 * Calcula a nota (50–100) ou reprovação (tempo acima do limite da nota 50).
 * Mesma tabela numérica para sexo feminino e masculino.
 */
export function notaCorrida2400(tempoMs: number, idadeAnos: number): NotaCorrida2400Result {
  const faixa = faixaEtariaCorrida2400(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = tempoMs / 1000;
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = FAIXA_TABELA[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

/** @deprecated Use notaCorrida2400 */
export function notaCorrida2400Masculino(tempoMs: number, idadeAnos: number): NotaCorrida2400Result {
  return notaCorrida2400(tempoMs, idadeAnos);
}

/**
 * Texto para UI / cadastro: "100" … "50", "REPROVADO", ou "—" (idade inválida/fora faixa).
 * Sexo feminino e masculino usam a mesma tabela; sexo só importa se no futuro houver normas distintas.
 */
export function textoNotaCorrida(
  tempoMs: number,
  idadeAnos: number | null,
  _sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';

  const r = notaCorrida2400(tempoMs, idadeAnos);
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

/** @deprecated Use textoNotaCorrida */
export function textoNotaCorridaMasculina(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  return textoNotaCorrida(tempoMs, idadeAnos, sexo);
}
