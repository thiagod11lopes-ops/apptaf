import { dataBrParaIso } from './tafRegistro';

/** Antecedência de fechamento da agenda pública (horas antes do início). */
export type FechamentoAntecedenciaHoras = 12 | 24 | 48;

export const FECHAMENTO_ANTECEDENCIA_OPCOES: Array<{
  value: FechamentoAntecedenciaHoras | '';
  label: string;
}> = [
  { value: '', label: 'Sem limite antecipado (fecha na hora da prova)' },
  { value: 48, label: '48h antes' },
  { value: 24, label: '24h antes' },
  { value: 12, label: '12h antes' },
];

export const HORAS_INICIO_DIA: Array<{ value: number; label: string }> = Array.from(
  { length: 24 },
  (_, h) => ({
    value: h,
    label: `${String(h).padStart(2, '0')}h`,
  }),
);

export function normalizarHoraInicio(raw: unknown, fallback = 8): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(23, Math.max(0, Math.floor(n)));
}

export function normalizarFechamentoAntecedencia(
  raw: unknown,
): FechamentoAntecedenciaHoras | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (n === 12 || n === 24 || n === 48) return n;
  return null;
}

/** Timestamp (ms) do início dos testes do slot. */
export function horarioInicioProvaMs(input: {
  data: string;
  horaInicio?: number | null;
}): number | null {
  const iso = dataBrParaIso(input.data);
  if (!iso) return null;
  const [ys, ms, ds] = iso.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const hora = normalizarHoraInicio(input.horaInicio, 8);
  return new Date(y, m - 1, d, hora, 0, 0, 0).getTime();
}

/** Timestamp (ms) em que a agenda deste slot fecha. */
export function horarioFechamentoAgendaMs(input: {
  data: string;
  horaInicio?: number | null;
  fechamentoAntecedenciaHoras?: number | null;
}): number | null {
  const inicioProva = horarioInicioProvaMs(input);
  if (inicioProva == null) return null;
  const ant = normalizarFechamentoAntecedencia(input.fechamentoAntecedenciaHoras);
  if (ant != null) return inicioProva - ant * 60 * 60 * 1000;
  return inicioProva;
}

export function agendaSlotFinalizada(input: {
  data: string;
  horaInicio?: number | null;
  fechamentoAntecedenciaHoras?: number | null;
  maxParticipantes: number;
  reservados?: number;
  agoraMs?: number;
}): boolean {
  const reservados = Math.max(0, input.reservados ?? 0);
  if (reservados >= Math.max(1, input.maxParticipantes)) return true;
  const fechamento = horarioFechamentoAgendaMs(input);
  if (fechamento == null) return false;
  return (input.agoraMs ?? Date.now()) >= fechamento;
}

/** 12h após o início dos testes — slot deve ser removido da disponibilidade. */
export const HORAS_EXPIRACAO_APOS_INICIO = 12;

export function slotExpiradoAposProva(input: {
  data: string;
  horaInicio?: number | null;
  agoraMs?: number;
}): boolean {
  const inicio = horarioInicioProvaMs(input);
  if (inicio == null) return false;
  return (input.agoraMs ?? Date.now()) >= inicio + HORAS_EXPIRACAO_APOS_INICIO * 60 * 60 * 1000;
}
