/**
 * Notas da prova de natação (50 m) — tabelas masculina e feminina.
 * Tempos máximos em MM:SS por nota (50–100); tempo de chegada <= limite → nota.
 * Faixas: 18–30, 31–40, 41–49, 50 anos ou mais.
 */

import { tempoStringParaSegundos } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { parseTafPerformanceInput } from './tafTimeFormat';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

/** Converte MM:SS da norma em segundos. */
function mmssParaSegundos(mmss: string): number {
  const sec = tempoStringParaSegundos(mmss);
  if (sec == null) throw new Error(`Tempo inválido na norma de natação: ${mmss}`);
  return sec;
}

/**
 * Linha da norma: tempos na ordem 50, 60, 70, 80, 90, 100 →
 * limites internos em segundos [100, 90, 80, 70, 60, 50].
 */
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

export type FaixaEtariaNatacao = '18-30' | '31-40' | '41-49' | '50+';

/** Masculino 50 m — limites em segundos [100, 90, 80, 70, 60, 50]. */
const M_18_30 = limitesNatacaoPorNota('01:30', '01:20', '01:10', '01:00', '00:50', '00:40');
const M_31_40 = limitesNatacaoPorNota('01:35', '01:25', '01:15', '01:05', '00:55', '00:45');
const M_41_49 = limitesNatacaoPorNota('01:40', '01:30', '01:20', '01:10', '01:00', '00:50');
const M_ACIMA_50 = limitesNatacaoPorNota('01:45', '01:35', '01:25', '01:15', '01:05', '00:55');

/** Feminino 50 m — limites em segundos [100, 90, 80, 70, 60, 50]. */
const F_18_30 = limitesNatacaoPorNota('02:20', '02:10', '02:00', '01:50', '01:40', '01:30');
const F_31_40 = limitesNatacaoPorNota('02:25', '02:15', '02:05', '01:55', '01:45', '01:35');
const F_41_49 = limitesNatacaoPorNota('02:30', '02:20', '02:10', '02:00', '01:50', '01:40');
const F_ACIMA_50 = limitesNatacaoPorNota('02:35', '02:25', '02:15', '02:05', '01:55', '01:45');

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

/** F = tabela feminina; M ou indefinido = tabela masculina. */
export function sexoTabelaNatacao(sexo?: 'M' | 'F'): 'M' | 'F' {
  return sexo === 'F' ? 'F' : 'M';
}

/**
 * Faixa etária para natação 50 m.
 * Abaixo de 18 anos retorna null (sem nota na UI).
 */
export function faixaEtariaNatacao(idadeAnos: number): FaixaEtariaNatacao | null {
  if (idadeAnos < 18) return null;
  if (idadeAnos <= 30) return '18-30';
  if (idadeAnos <= 40) return '31-40';
  if (idadeAnos <= 49) return '41-49';
  return '50+';
}

function tabelaNatacao(sexo: 'M' | 'F' | undefined): Record<FaixaEtariaNatacao, readonly number[]> {
  return sexoTabelaNatacao(sexo) === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M;
}

export type NotaNatacaoResult =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

/**
 * Nota de natação a partir do tempo (ms), idade e sexo.
 */
export function notaNatacao(
  tempoMs: number,
  idadeAnos: number,
  sexo: 'M' | 'F' | undefined,
): NotaNatacaoResult {
  const faixa = faixaEtariaNatacao(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
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
 * Texto para UI / cadastro: "100" … "50", "REPROVADO", ou "—".
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
