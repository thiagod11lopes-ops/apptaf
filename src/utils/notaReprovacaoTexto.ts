/** Nota de desistência na corrida: REP. (n VOLTA) / REP. (n VOLTAS). */
export function formatNotaDesistenciaCorrida(voltasCompletas: number): string {
  const n = Math.max(0, Math.floor(Number(voltasCompletas) || 0));
  const unidade = n === 1 ? 'VOLTA' : 'VOLTAS';
  return `REP. (${n} ${unidade})`;
}

/** REPROVADO clássico ou REP. (n) / REP. (n VOLTA|VOLTAS) da desistência na corrida. */
export function isNotaReprovacaoTexto(nota: string | undefined | null): boolean {
  const n = (nota ?? '').trim().toUpperCase();
  if (!n) return false;
  if (n === 'REPROVADO') return true;
  return /^REP\.\s*\(\d+(?:\s+VOLTAS?)?\)$/.test(n);
}
