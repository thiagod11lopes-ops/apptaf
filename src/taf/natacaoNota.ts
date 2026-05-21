/**
 * Notas da prova de natação — feminino e masculino.
 * Tempos em segundos como limites máximos por nota (50–100); mesma lógica cumulativa
 * que corrida 2400 m. Sexo indefinido usa tabela masculina (alinhado ao cadastro padrão).
 */

import { parseTafPerformanceInput } from './tafTimeFormat';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

/** Faixas etárias da natação (tabelas F/M próprias; independentes da corrida). */
type FaixaEtariaNatacao =
  | '18-25'
  | '26-30'
  | '31-35'
  | '36-40'
  | '41-45'
  | '46-50';

function faixaEtariaNatacao(idadeAnos: number): FaixaEtariaNatacao | null {
  if (idadeAnos >= 18 && idadeAnos <= 25) return '18-25';
  if (idadeAnos >= 26 && idadeAnos <= 30) return '26-30';
  if (idadeAnos >= 31 && idadeAnos <= 35) return '31-35';
  if (idadeAnos >= 36 && idadeAnos <= 40) return '36-40';
  if (idadeAnos >= 41 && idadeAnos <= 45) return '41-45';
  if (idadeAnos >= 46 && idadeAnos <= 50) return '46-50';
  return null;
}

/** Feminino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const TABELA_F_18_25 = [60, 65, 70, 75, 80, 85] as const;
const TABELA_F_26_30 = [62, 67, 72, 77, 82, 87] as const;
const TABELA_F_31_35 = [64, 69, 74, 79, 84, 89] as const;
const TABELA_F_36_40 = [66, 71, 76, 81, 86, 91] as const;
const TABELA_F_41_45 = [68, 73, 78, 83, 88, 93] as const;
const TABELA_F_46_50 = [70, 75, 80, 85, 90, 95] as const;

/** Masculino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const TABELA_M_18_25 = [50, 55, 60, 65, 70, 75] as const;
const TABELA_M_26_30 = [52, 57, 62, 67, 72, 77] as const;
const TABELA_M_31_35 = [54, 59, 64, 69, 74, 79] as const;
const TABELA_M_36_40 = [56, 61, 66, 71, 76, 81] as const;
const TABELA_M_41_45 = [58, 63, 68, 73, 78, 83] as const;
const TABELA_M_46_50 = [60, 65, 70, 75, 80, 85] as const;

const FAIXA_TABELA_F: Record<FaixaEtariaNatacao, readonly number[]> = {
  '18-25': TABELA_F_18_25,
  '26-30': TABELA_F_26_30,
  '31-35': TABELA_F_31_35,
  '36-40': TABELA_F_36_40,
  '41-45': TABELA_F_41_45,
  '46-50': TABELA_F_46_50,
};

const FAIXA_TABELA_M: Record<FaixaEtariaNatacao, readonly number[]> = {
  '18-25': TABELA_M_18_25,
  '26-30': TABELA_M_26_30,
  '31-35': TABELA_M_31_35,
  '36-40': TABELA_M_36_40,
  '41-45': TABELA_M_41_45,
  '46-50': TABELA_M_46_50,
};

export type NotaNatacaoResult =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

function tabelaNatacao(sexo: 'M' | 'F' | undefined): Record<FaixaEtariaNatacao, readonly number[]> {
  return sexo === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M;
}

/**
 * Nota de natação a partir do tempo (ms), idade e sexo (F = tabela feminina; M ou indefinido = masculina).
 */
export function notaNatacao(tempoMs: number, idadeAnos: number, sexo: 'M' | 'F' | undefined): NotaNatacaoResult {
  const faixa = faixaEtariaNatacao(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = tempoMs / 1000;
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = tabelaNatacao(sexo)[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

/**
 * Texto para UI / cadastro: "100" … "50", "REPROVADO", ou "—" (idade fora da faixa / inválida).
 */
export function textoNotaNatacao(
  tempoMs: number,
  idadeAnos: number | null,
  sexo: 'M' | 'F' | undefined,
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';

  const r = notaNatacao(tempoMs, idadeAnos, sexo);
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

/** Valor para gravar no cadastro (`undefined` quando não há nota). */
export function notaNatacaoParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

/** Recalcula nota de natação a partir de tempo + nascimento + sexo. */
export function textoNotaNatacaoFromCadastro(input: {
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
  return textoNotaNatacao(tempoMs, idade, input.sexo);
}

/** @deprecated Use `notaNatacao` / `textoNotaNatacao` */
export function notaNatacaoFeminina(tempoMs: number, idadeAnos: number): NotaNatacaoResult {
  return notaNatacao(tempoMs, idadeAnos, 'F');
}

/** @deprecated Use `textoNotaNatacao` */
export function textoNotaNatacaoFeminina(
  tempoMs: number,
  idadeAnos: number | null,
  sexo: 'M' | 'F' | undefined,
): string {
  return textoNotaNatacao(tempoMs, idadeAnos, sexo);
}
