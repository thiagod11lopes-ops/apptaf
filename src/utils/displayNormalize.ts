/**
 * Normalização de exibição: substituir termos incorretos (autocorretor) pelos corretos.
 * Pç → Praça | ENTÃO → SO | BERLISCAR/Beliscar → NIP
 */

export function normalizePraça(value: string): string {
  if (value === 'Pç' || value === 'Pça') return 'Praça';
  return value;
}

export function normalizeSO(value: string): string {
  if (value === 'ENTÃO' || value === 'Então') return 'SO';
  return value;
}

export function normalizeNIP(value: string): string {
  const v = value.trim();
  if (v === 'BERLISCAR' || v === 'Beliscar' || v === 'berliscar') return 'NIP';
  return value;
}

/** Indica se o valor normalizado de categoria é Praça (para usar RotuloPracaSvg). */
export function isCategoriaPraça(value: string): boolean {
  return normalizePraça(value) === 'Praça';
}

/** Indica se o valor normalizado de graduação é SO (para usar LabelGradSO). */
export function isGraduacaoSO(value: string): boolean {
  return normalizeSO(value) === 'SO';
}
