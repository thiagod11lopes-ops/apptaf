/**
 * Regras de poda por ausência na nuvem (cloud SoT).
 * Extraídas para teste unitário — evita loop baixar→apagar→baixar no autorizado.
 */

export type CloudAbsencePruneGate = {
  fetchMode: 'full' | 'incremental';
  /** false = decrypt parcial / snapshot incompleto. */
  trustworthyForPrune: boolean;
  isAuthorizedMember: boolean;
};

/** Só o chefe, em full fetch confiável, pode podar local synced ausente na nuvem. */
export function shouldAllowCloudAbsencePrune(gate: CloudAbsencePruneGate): boolean {
  return (
    gate.fetchMode === 'full' &&
    gate.trustworthyForPrune !== false &&
    !gate.isAuthorizedMember
  );
}

export type AbsencePlanAction = 'prune' | 'preserve';

/**
 * Id só no local, já synced, sem force-upload:
 * - prune → tombstone sintético (download deleted)
 * - preserve → não apagar (membro / incremental / snapshot parcial)
 */
export function decideSyncedLocalOnlyAbsence(allowCloudAbsencePrune: boolean): AbsencePlanAction {
  return allowCloudAbsencePrune ? 'prune' : 'preserve';
}

/** Limiar: max(50, 5% do local). Acima disso o lote de prune é suspeito. */
export function massSyntheticPruneThreshold(localCount: number): number {
  return Math.max(50, Math.ceil(Math.max(localCount, 1) * 0.05));
}

export type SyntheticPruneLikeItem = {
  collection: string;
  id: string;
  action: 'download' | 'upload' | string;
  remote?: { syntheticCloudAbsence?: boolean } | null;
};

/**
 * Remove podas sintéticas em massa de um plano LWW.
 * Retorna o plano filtrado e quantos itens foram bloqueados.
 */
export function stripMassSyntheticPrune<T extends SyntheticPruneLikeItem>(
  plan: T[],
  localCount: number,
): { plan: T[]; stripped: number; threshold: number } {
  const threshold = massSyntheticPruneThreshold(localCount);
  const prunes = plan.filter(
    (p) => p.action === 'download' && p.remote?.syntheticCloudAbsence === true,
  );
  if (prunes.length < threshold) {
    return { plan, stripped: 0, threshold };
  }
  const pruneIds = new Set(prunes.map((p) => `${p.collection}:${p.id}`));
  return {
    plan: plan.filter((p) => !pruneIds.has(`${p.collection}:${p.id}`)),
    stripped: prunes.length,
    threshold,
  };
}
