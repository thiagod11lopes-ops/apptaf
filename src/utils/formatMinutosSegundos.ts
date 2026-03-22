import { tempoStringParaSegundos } from './calcularIdade';

/**
 * Máscara progressiva MM:SS (minutos e segundos), até 4 dígitos.
 * Ex.: 1234 → 12:34
 */
export function formatMinutosSegundosInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Vazio é válido (campo opcional). Primeiro campo = minutos, segundo = segundos (00–59). */
export function tempoMinutosSegundosValido(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  const m = /^(\d+):(\d{2})$/.exec(t);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  return mm >= 0 && Number.isFinite(mm) && ss >= 0 && ss <= 59;
}

/** Normaliza valor já salvo para exibição (ex.: 3:05 → 03:05; 105:03 mantém minutos longos). */
export function tempoParaExibicao(s: string | undefined): string {
  if (!s?.trim()) return '';
  const m = /^(\d+):(\d{2})$/.exec(s.trim());
  if (m) {
    const minRaw = m[1];
    const mm = minRaw.length === 1 ? minRaw.padStart(2, '0') : minRaw;
    return `${mm}:${m[2]}`;
  }
  return s.trim();
}

/** `MM:SS` como minutos e segundos → total em segundos (ex.: 05:03 → 303). */
export function parseMinutosSegundosBrParaSegundos(s: string): number | null {
  return tempoStringParaSegundos(s.trim());
}
