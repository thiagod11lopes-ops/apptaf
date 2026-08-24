/**
 * Ordem de antiguidade militar (maior = mais antigo no posto).
 * CALTE → … → MN/SD.
 */
const ORDEM_ANTIGUIDADE: Record<string, number> = {
  CALTE: 100,
  CMG: 95,
  CF: 90,
  CC: 85,
  CT: 80,
  '1°TEN': 75,
  '1TEN': 75,
  '2°TEN': 70,
  '2TEN': 70,
  GM: 65,
  SO: 55,
  '1°SG': 50,
  '1SG': 50,
  '2°SG': 45,
  '2SG': 45,
  '3°SG': 40,
  '3SG': 40,
  CB: 30,
  MN: 20,
  MNRC: 20,
  SD: 10,
};

export function normalizarPostoGrad(raw: string | null | undefined): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/º/g, '°');
}

export function rankAntiguidadePosto(posto: string | null | undefined): number {
  const key = normalizarPostoGrad(posto);
  if (!key) return 0;
  if (ORDEM_ANTIGUIDADE[key] != null) return ORDEM_ANTIGUIDADE[key]!;
  // Tentativas sem símbolo de grau
  const alt = key.replace(/°/g, '');
  if (ORDEM_ANTIGUIDADE[alt] != null) return ORDEM_ANTIGUIDADE[alt]!;
  return 0;
}

/**
 * Compara por antiguidade (CALTE primeiro). Em empate, menor updatedAt (cadastrou primeiro) vem antes.
 */
export function compararAntiguidadeMilitar(
  a: { posto?: string | null; updatedAt?: number | null },
  b: { posto?: string | null; updatedAt?: number | null },
): number {
  const ra = rankAntiguidadePosto(a.posto);
  const rb = rankAntiguidadePosto(b.posto);
  if (ra !== rb) return rb - ra;
  return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
}
