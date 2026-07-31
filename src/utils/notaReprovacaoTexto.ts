/** Nota de desistência na corrida: REP. (voltas completas). */
export function formatNotaDesistenciaCorrida(voltasCompletas: number): string {
  const n = Math.max(0, Math.floor(Number(voltasCompletas) || 0));
  return `REP. (${n})`;
}

/** REPROVADO clássico ou REP. (n) da desistência na corrida. */
export function isNotaReprovacaoTexto(nota: string | undefined | null): boolean {
  const n = (nota ?? '').trim().toUpperCase();
  if (!n) return false;
  if (n === 'REPROVADO') return true;
  return /^REP\.\s*\(\d+\)$/.test(n);
}
