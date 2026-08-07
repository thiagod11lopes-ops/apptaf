/**
 * Formatação de tempo de prova / cronômetro.
 * Tempos de resultado (tabela): **MM:SS:CS**.
 * Cronômetro na prova ativa: **MM:SS** (sem centésimos).
 */

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
 * Formata ms em **MM:SS:CS** (minutos totais : segundos : centésimos 00–99).
 * Ex.: 303_450 ms → `05:03:45`. Minutos podem passar de 59.
 */
export function formatElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  return `${totalMin.toString().padStart(2, '0')}:${pad2(s)}:${pad2(cs)}`;
}

/**
 * Formata ms em **MM:SS** para o cronômetro da prova ativa (sem centésimos).
 * Ex.: 303_450 ms → `05:03`.
 */
export function formatCronometroElapsedMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  return `${totalMin.toString().padStart(2, '0')}:${pad2(s)}`;
}

/**
 * Interpreta `MM:SS:CS` (ou legado `MM:SS`) → milissegundos.
 * `MM:SS` assume centésimos 00.
 */
export function parseFormatoElapsedParaMs(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const partes = t.split(':').map((p) => p.replace(/\D/g, ''));
  if (partes.length === 2) {
    const minutos = parseInt(partes[0], 10);
    const segundos = parseInt(partes[1], 10);
    if (!Number.isFinite(minutos) || !Number.isFinite(segundos) || segundos > 59) return null;
    if (minutos < 0 || segundos < 0) return null;
    return minutos * 60_000 + segundos * 1000;
  }
  if (partes.length === 3) {
    const minutos = parseInt(partes[0], 10);
    const segundos = parseInt(partes[1], 10);
    const centesimos = parseInt(partes[2], 10);
    if (
      !Number.isFinite(minutos) ||
      !Number.isFinite(segundos) ||
      !Number.isFinite(centesimos) ||
      minutos < 0 ||
      segundos < 0 ||
      centesimos < 0 ||
      segundos > 59 ||
      centesimos > 99
    ) {
      return null;
    }
    return minutos * 60_000 + segundos * 1000 + centesimos * 10;
  }
  return null;
}

/**
 * Interpreta o formato de exibição → segundos totais (truncados).
 */
export function parseFormatoElapsedParaSegundos(s: string): number | null {
  const ms = parseFormatoElapsedParaMs(s);
  if (ms == null) return null;
  return msParaSegundosProvaInteiros(ms);
}

/** Offset Date para `useStopwatch().reset(offset)` = tempo inicial em ms. */
export function stopwatchOffsetFromElapsedMs(ms: number): Date {
  const safe = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Date(Date.now() + safe);
}
