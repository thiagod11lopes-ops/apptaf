export function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

/** Formata ms apenas em minutos e segundos (mm:ss; minutos pode passar de 59). */
export function formatElapsedMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  return `${totalMin.toString().padStart(2, '0')}:${pad2(s)}`;
}
