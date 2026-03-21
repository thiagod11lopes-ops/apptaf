/**
 * Máscara progressiva MM:SS (minutos e segundos), até 4 dígitos.
 * Ex.: 1234 → 12:34
 */
export function formatMinutosSegundosInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Vazio é válido (campo opcional). */
export function tempoMinutosSegundosValido(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return false;
  const mm = parseInt(m[1], 10);
  const ss = parseInt(m[2], 10);
  return mm >= 0 && mm <= 99 && ss >= 0 && ss <= 59;
}

/** Normaliza valor já salvo para exibição (ex.: 3:05 → 03:05). */
export function tempoParaExibicao(s: string | undefined): string {
  if (!s?.trim()) return '';
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (m) {
    const mm = m[1].padStart(2, '0');
    return `${mm}:${m[2]}`;
  }
  return s.trim();
}
