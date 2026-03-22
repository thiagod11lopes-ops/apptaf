import { tempoStringParaSegundos } from './calcularIdade';

export function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

/**
 * Segundos inteiros para prova / nota: **trunca** milissegundos (não arredonda).
 * Décimos e centésimos de segundo não alteram o valor usado nas tabelas.
 */
export function msParaSegundosProvaInteiros(ms: number): number {
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / 1000);
}

/**
 * Formata ms em **MM:SS** (primeiro campo = **minutos totais**, segundo = **segundos**).
 * Ex.: 303000 ms → `05:03` (5 min 3 s). Minutos podem passar de 59.
 * Usa o mesmo critério que `msParaSegundosProvaInteiros` (truncagem, não arredondamento).
 */
export function formatElapsedMs(ms: number): string {
  const totalSec = msParaSegundosProvaInteiros(ms);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  return `${totalMin.toString().padStart(2, '0')}:${pad2(s)}`;
}

/**
 * Interpreta o mesmo formato que `formatElapsedMs` gera: **minutos:segundos** → segundos totais.
 * Ex.: `05:03` → 303 (não “5 segundos e 3 centésimos”).
 */
export function parseFormatoElapsedParaSegundos(s: string): number | null {
  return tempoStringParaSegundos(s.trim());
}

/** `MM:SS` de exibição → milissegundos. */
export function parseFormatoElapsedParaMs(s: string): number | null {
  const sec = tempoStringParaSegundos(s.trim());
  if (sec == null) return null;
  return sec * 1000;
}
