/** Ordenação segura por nome (pt-BR), mesmo quando o campo está ausente. */
export function compareNomePtBr(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return (a ?? '').localeCompare(b ?? '', 'pt-BR');
}

export function compareByNomePtBr<T extends { nome?: string | null }>(a: T, b: T): number {
  return compareNomePtBr(a.nome, b.nome);
}
