import { nipDigitos } from './nipFormat';
import { isRubricaImagemDataUrl } from './rubricaPresence';
import type { SessaoResultadoRubrica } from './sessaoLight';

function chave(r: SessaoResultadoRubrica): string {
  return `${nipDigitos(r.nip)}:${r.prova}`;
}

/** Une rúbricas por NIP+prova; `primary` vence em conflito. */
export function mergeSessaoResultadoRubricas(
  fallback: SessaoResultadoRubrica[] | undefined,
  primary: SessaoResultadoRubrica[] | undefined,
): SessaoResultadoRubrica[] {
  const map = new Map<string, SessaoResultadoRubrica>();
  for (const r of fallback ?? []) {
    if (!isRubricaImagemDataUrl(r.rubricaCandidatoSvg)) continue;
    const k = chave(r);
    if (!k.startsWith(':')) map.set(k, { ...r, nip: r.nip, rubricaCandidatoSvg: r.rubricaCandidatoSvg.trim() });
  }
  for (const r of primary ?? []) {
    if (!isRubricaImagemDataUrl(r.rubricaCandidatoSvg)) continue;
    const k = chave(r);
    if (!k.startsWith(':')) map.set(k, { ...r, nip: r.nip, rubricaCandidatoSvg: r.rubricaCandidatoSvg.trim() });
  }
  return Array.from(map.values());
}

export function pickAplicadorRubricaSvg(
  ...candidates: Array<string | undefined | null>
): string | undefined {
  for (const c of candidates) {
    if (isRubricaImagemDataUrl(c)) return c!.trim();
  }
  return undefined;
}
