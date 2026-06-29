/**
 * Notas da corrida 3200 m — Fuzileiros Navais (CGCFN-108 § 5.5.2).
 */

import { tempoStringParaMsProva } from '../utils/calcularIdade';
import { msParaSegundosProvaInteiros } from '../utils/formatRaceTime';
import { idadeFromDataNascimento } from '../utils/idadeFromDataNascimento';
import { faixaEtariaFn, type FaixaEtariaFn } from './fnFaixaEtaria';

const NOTAS_DESC = [100, 90, 80, 70, 60, 50] as const;

function mmssParaSegundos(mmss: string): number {
  const [mm, ss] = mmss.split(':').map((x) => parseInt(x, 10));
  return mm * 60 + ss;
}

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

const M_18_25 = limitesCorridaPorNota('18:30', '17:20', '16:32', '15:28', '14:24', '13:04');
const M_26_33 = limitesCorridaPorNota('19:00', '17:52', '17:04', '16:00', '14:56', '13:36');
const M_34_39 = limitesCorridaPorNota('19:30', '18:56', '18:08', '17:04', '16:00', '14:40');
const M_40_45 = limitesCorridaPorNota('20:48', '20:00', '18:24', '17:20', '16:16', '14:56');
const M_46_49 = limitesCorridaPorNota('22:24', '21:36', '19:44', '18:40', '17:36', '16:16');
const M_50_54 = limitesCorridaPorNota('22:56', '22:08', '20:16', '19:12', '18:08', '16:48');
const M_55_60 = limitesCorridaPorNota('23:28', '21:40', '20:48', '19:44', '18:40', '17:20');

const F_18_25 = limitesCorridaPorNota('20:30', '17:36', '17:04', '16:32', '16:00', '15:12');
const F_26_33 = limitesCorridaPorNota('21:00', '19:12', '18:40', '17:52', '17:04', '16:00');
const F_34_39 = limitesCorridaPorNota('21:30', '20:16', '19:44', '18:56', '18:08', '17:04');
const F_40_45 = limitesCorridaPorNota('23:20', '22:24', '21:36', '20:32', '19:28', '18:24');
const F_46_49 = limitesCorridaPorNota('24:32', '23:44', '22:56', '21:52', '20:48', '19:44');
const F_50_54 = limitesCorridaPorNota('26:40', '25:52', '24:32', '23:12', '21:52', '20:32');
const F_55_60 = limitesCorridaPorNota('27:28', '26:24', '25:04', '23:44', '22:24', '21:04');

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

export type NotaCorrida3200Result =
  | { kind: 'nota'; valor: (typeof NOTAS_DESC)[number] }
  | { kind: 'reprovado' }
  | { kind: 'fora_tabela' };

export function notaCorrida3200(
  tempoMs: number,
  idadeAnos: number,
  sexo?: 'M' | 'F',
): NotaCorrida3200Result {
  const faixa = faixaEtariaFn(idadeAnos);
  if (!faixa) return { kind: 'fora_tabela' };

  const sec = msParaSegundosProvaInteiros(tempoMs);
  if (!Number.isFinite(sec) || sec < 0) return { kind: 'reprovado' };

  const tabela = sexo === 'F' ? FAIXA_TABELA_F : FAIXA_TABELA_M;
  const limites = tabela[faixa];
  for (let i = 0; i < limites.length; i += 1) {
    if (sec <= limites[i]) {
      return { kind: 'nota', valor: NOTAS_DESC[i] };
    }
  }
  return { kind: 'reprovado' };
}

export function textoNotaCorrida3200(
  tempoMs: number,
  idadeAnos: number | null,
  sexo?: 'M' | 'F',
): string {
  if (idadeAnos === null || !Number.isFinite(idadeAnos)) return '—';
  const r = notaCorrida3200(tempoMs, idadeAnos, sexo);
  if (r.kind === 'fora_tabela') return '—';
  if (r.kind === 'reprovado') return 'REPROVADO';
  return String(r.valor);
}

export function notaCorrida3200ParaPersistencia(notaTexto: string): string | undefined {
  const t = notaTexto.trim();
  return t === '' || t === '—' ? undefined : t;
}

export function textoNotaCorrida3200FromCadastro(input: {
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
  return textoNotaCorrida3200(tempoMs, idade, input.sexo);
}
