/**
 * IDs opacos para linhas na nuvem (restritos / fatores_risco).
 * Evita usar o NIP (8 dígitos) como coluna `id` em texto claro.
 */

export function newOpaqueCloudDocId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

/** Formato antigo: id da linha = NIP (8 dígitos). */
export function isLegacyNipCloudDocId(id: string | null | undefined): boolean {
  return /^\d{8}$/.test((id ?? '').trim());
}

/** Preferência: cloudId local válido; senão id remoto opaco; senão gera novo. */
export function resolveOpaqueCloudDocId(options: {
  localCloudId?: string | null;
  remoteRowId?: string | null;
}): string {
  const local = (options.localCloudId ?? '').trim();
  if (local && !isLegacyNipCloudDocId(local)) return local;
  const remote = (options.remoteRowId ?? '').trim();
  if (remote && !isLegacyNipCloudDocId(remote)) return remote;
  return newOpaqueCloudDocId();
}
