/** Texto exibido na UI no lugar da imagem da rúbrica. */
export const RUBRICADO_DIGITALMENTE = 'Rubricado Digitalmente';

export function isRubricaImagemDataUrl(uri?: string | null): boolean {
  const raw = uri?.trim() ?? '';
  return (
    raw.startsWith('data:image/png') ||
    raw.startsWith('data:image/webp') ||
    raw.startsWith('data:image/jpeg') ||
    raw.startsWith('data:image/jpg') ||
    raw.startsWith('data:image/svg')
  );
}

/** Há rúbrica (imagem real ou marcador de presença). */
export function temRubricaPresente(uri?: string | null): boolean {
  const raw = uri?.trim() ?? '';
  if (!raw) return false;
  if (raw === RUBRICADO_DIGITALMENTE) return true;
  return isRubricaImagemDataUrl(raw);
}

/**
 * Prefere data-URL de imagem sobre o marcador "Rubricado Digitalmente".
 * Ordem: primeira imagem válida; senão primeiro marcador/presença.
 */
export function preferRubrica(
  ...vals: Array<string | null | undefined>
): string | undefined {
  for (const v of vals) {
    if (isRubricaImagemDataUrl(v)) return v!.trim();
  }
  for (const v of vals) {
    if (temRubricaPresente(v)) return v!.trim();
  }
  return undefined;
}

/** Substitui imagem por marcador; preserva marcador/vazio. */
export function paraMarcadorRubrica(uri?: string | null): string | undefined {
  if (!uri?.trim()) return undefined;
  if (temRubricaPresente(uri)) return RUBRICADO_DIGITALMENTE;
  return undefined;
}
