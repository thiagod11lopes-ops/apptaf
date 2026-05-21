/**
 * Notas da prova de corrida (2400 m) — tabelas feminina e masculina.
 * Faixas etárias e tempos máximos (MM:SS) conforme norma TAF:
 * notas 50, 60, 70, 80, 90, 100 — tempo de término <= limite → nota correspondente.
 */

import { tempoStringParaMsProva } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

/** Converte MM:SS da norma em segundos. */
function mmssParaSegundos(mmss: string): number {
  const [mm, ss] = mmss.split(':').map((x) => parseInt(x, 10));
  return mm * 60 + ss;
}

/**
 * Linha da norma: tempos na ordem 50, 60, 70, 80, 90, 100 →
 * limites internos na ordem 100, 90, 80, 70, 60, 50.
 */
function limitesCorridaPorNota(
  t50: string,
  t60: string,
  t70: string,
  t80: string,
  t90: string,
  t100: string,
): readonly number[] {
  return [t100, t90, t80, t70, t60, t50].map(mmssParaSegundos) as readonly number[];
}

export type FaixaEtariaCorrida2400 =
  | '18-25'
  | '26-33'
  | '34-39'
  | '40-45'
  | '46-49'
  | '50+';

/** Masculino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const M_18_25 = limitesCorridaPorNota('14:30', '13:30', '12:18', '11:18', '10:12', '09:36');
const M_26_33 = limitesCorridaPorNota('15:00', '14:00', '12:42', '11:42', '10:36', '10:00');
const M_34_39 = limitesCorridaPorNota('15:30', '14:30', '13:24', '12:24', '11:36', '10:48');
const M_40_45 = limitesCorridaPorNota('16:24', '15:36', '14:18', '13:00', '12:24', '11:36');
const M_46_49 = limitesCorridaPorNota('17:30', '16:12', '15:24', '14:36', '14:00', '13:12');
const M_ACIMA_50 = limitesCorridaPorNota('18:48', '17:24', '16:42', '16:00', '15:36', '14:48');

/** Feminino — limites em segundos [100, 90, 80, 70, 60, 50]. */
const F_18_25 = limitesCorridaPorNota('15:40', '15:00', '14:06', '13:12', '11:48', '11:12');
const F_26_33 = limitesCorridaPorNota('16:16', '15:30', '14:36', '13:42', '12:48', '12:00');
const F_34_39 = limitesCorridaPorNota('16:40', '16:18', '15:36', '14:30', '13:36', '12:48');
const F_40_45 = limitesCorridaPorNota('17:52', '17:18', '16:18', '15:24', '14:36', '13:36');
const F_46_49 = limitesCorridaPorNota('18:58', '18:18', '17:18', '16:24', '15:24', '14:24');
const F_ACIMA_50 = limitesCorridaPorNota('20:04', '19:30', '18:36', '17:30', '17:00', '16:00');

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

/** F = tabela feminina; M ou indefinido = tabela masculina (padrão do cadastro). */
export function sexoTabelaCorrida2400(sexo?: 'M' | 'F'): 'M' | 'F' {
  return sexo === 'F' ? 'F' : 'M';
}

function tabelaCorrida2400(sexo: 'M' | 'F' | undefined): Record<FaixaEtariaCorrida2400, readonly number[]> {
  return sexoTabelaCorrida2400(sexo) === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M;
}

/** @deprecated Use faixaEtariaCorrida2400 */
export function faixaEtariaCorridaMasculina(idadeAnos: number): FaixaEtariaCorrida2400 | null {
  return faixaEtariaCorrida2400(idadeAnos);
}

/**
 * Faixa etária para tabelas de corrida 2400 m (mesmas faixas em M e F).
 * 18–25, 26–33, 34–39, 40–45, 46–49, 50 anos ou mais.
 * Abaixo de 18 anos retorna null (sem nota na UI).
 */
export function faixaEtariaCorrida2400(idadeAnos: number): FaixaEtariaCorrida2400 | null {
  if (idadeAnos < 18) return null;
  if (idadeAnos <= 25) return '18-25';
  if (idadeAnos <= 33) return '26-33';
  if (idadeAnos <= 39) return '34-39';
  if (idadeAnos <= 45) return '40-45';
  if (idadeAnos <= 49) return '46-49';
  return '50+';
}

export type NotaCorrida2400Result =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

/** @deprecated Use notaCorrida2400 */
export type NotaCorridaMasculinaResult = NotaCorrida2400Result;

/**
 * Calcula a nota (50–100) ou reprovação (tempo acima do limite da nota 50).
 * `sexo`: F = tabela feminina; M ou indefinido = tabela masculina.
 */
export function notaCorrida2400(
  tempoMs: number,
  idadeAnos: number,
  sexo?: 'M' | 'F',
): NotaCorrida2400Result {
  const faixa = faixaEtariaCorrida2400(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const limites = tabelaCorrida2400(sexo)[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

/** @deprecated Use notaCorrida2400 com sexo M */
export function notaCorrida2400Masculino(tempoMs: number, idadeAnos: number): NotaCorrida2400Result {
  return notaCorrida2400(tempoMs, idadeAnos, 'M');
}

/**
 * Texto para UI / cadastro: "100" … "50", "REPROVADO", ou "—" (idade inválida / abaixo de 18).
 */
export function textoNotaCorrida(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';

  const r = notaCorrida2400(tempoMs, idadeAnos, sexoTabelaCorrida2400(sexo));
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

/** Valor para gravar no cadastro (`undefined` quando não há nota). */
export function notaCorridaParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

/**
 * Nota de corrida a partir dos dados do cadastro (fonte única da regra TAF).
 * Sempre recalcula a partir de tempo + nascimento + sexo — não usa `notaCorrida` salva.
 */
export function textoNotaCorridaFromCadastro(input: {
  tempoCorrida?: string | null;
  dataNascimento?: string | null;
  sexo?: 'M' | 'F';
  refDate?: Date;
}): string {
  const tempo = (input.tempoCorrida ?? '').trim();
  if (!tempo) return '—';
  const tempoMs = tempoStringParaMsProva(tempo);
  if (tempoMs == null) return '—';
  const idade = idadeFromDataNascimento((input.dataNascimento ?? '').trim(), input.refDate);
  return textoNotaCorrida(tempoMs, idade, input.sexo);
}

/** @deprecated Use textoNotaCorrida */
export function textoNotaCorridaMasculina(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  return textoNotaCorrida(tempoMs, idadeAnos, sexo);
}
