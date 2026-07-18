/**
 * Guarda de confirmação de sync da fila.
 *
 * Uma operação da SyncQueue só pode marcar o registro local como "synced"
 * se o registro no Dexie ainda estiver na MESMA versão que foi enviada.
 * Se o usuário editou o registro durante o upload, a confirmação é ignorada
 * e o registro permanece pendente (a nova edição já está na fila).
 */

import { readSyncVersion } from './recordMeta';
import { getCadastroRaw, getAplicadorRaw, getSessaoRaw } from '../db/localDb';

export type QueueSyncCollection = 'cadastros' | 'sessoes' | 'aplicadores';

type VersionedRecord = {
  syncVersion?: number;
  version?: number;
} | null | undefined;

/**
 * Decisão pura: permite confirmar "synced" apenas quando o registro local
 * atual ainda possui exatamente a versão enviada à nuvem.
 * Registro inexistente localmente → não confirma (evita ressuscitar dados).
 */
export function canConfirmSyncedVersion(current: VersionedRecord, sent: VersionedRecord): boolean {
  if (!current || !sent) return false;
  return readSyncVersion(current) === readSyncVersion(sent);
}

/** Relê o registro no Dexie e compara com a versão que foi enviada. */
export async function isQueuePayloadStillCurrent(
  collection: QueueSyncCollection,
  documentId: string,
  sentPayload: VersionedRecord,
): Promise<boolean> {
  if (!documentId) return false;
  const current =
    collection === 'cadastros'
      ? await getCadastroRaw(documentId)
      : collection === 'aplicadores'
        ? await getAplicadorRaw(documentId)
        : await getSessaoRaw(documentId);
  return canConfirmSyncedVersion(current, sentPayload);
}
