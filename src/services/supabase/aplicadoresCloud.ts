import type { AplicadorItemPersist } from '../aplicadoresIndexedDb';
import { tombstoneToCloudDoc, type TombstonePayload } from '../../offline-first/sync/tombstone';
import { compareByNomePtBr } from '../../utils/compareNomePtBr';
import { stripSenhaFromAplicador, toAplicadorFirestorePayload } from '../../utils/aplicadorSyncPolicy';
import { deleteOwnerDoc, listOwnerDocs, listOwnerDocsSince, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'aplicadores';

export async function getAllAplicadoresFirestore(uid: string): Promise<AplicadorItemPersist[]> {
  const rows = await listOwnerDocs(TABLE, uid);
  return rowsToAplicadores(rows);
}

function rowsToAplicadores(rows: Awaited<ReturnType<typeof listOwnerDocs>>): AplicadorItemPersist[] {
  return rows
    .filter((row) => !row.deleted)
    .map((row) => {
      const raw = rowToDoc<AplicadorItemPersist & { deleted?: boolean }>(row);
      return stripSenhaFromAplicador({
        ...raw,
        id: row.id,
        nome: (raw.nome ?? '').trim() || '—',
      });
    })
    .sort(compareByNomePtBr);
}

export async function getAplicadoresFirestoreSince(
  uid: string,
  sinceUpdatedAt: number,
): Promise<AplicadorItemPersist[]> {
  const rows = await listOwnerDocsSince(TABLE, uid, sinceUpdatedAt);
  return rowsToAplicadores(rows);
}

export async function addAplicadorFirestore(uid: string, item: AplicadorItemPersist): Promise<void> {
  const docId = item.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const payload = toAplicadorCloudPayload(item);
  const syncVersion =
    typeof (payload as { syncVersion?: number }).syncVersion === 'number'
      ? (payload as { syncVersion: number }).syncVersion
      : typeof (payload as { version?: number }).version === 'number'
        ? (payload as { version: number }).version
        : undefined;
  await upsertOwnerDoc(
    TABLE,
    uid,
    docId,
    {
      id: docId,
      nip: payload.nip || '',
      nome: payload.nome || 'Sem Nome',
      categoria: payload.categoria || 'Praças',
      sexo: payload.sexo,
      oficial: payload.oficial,
      praca: payload.praca,
      senhaHash: payload.senhaHash,
      updatedAt: payload.updatedAt ?? Date.now(),
      ...(syncVersion != null ? { syncVersion, version: syncVersion } : {}),
    },
    payload.updatedAt ?? Date.now(),
  );
}

function toAplicadorCloudPayload(item: AplicadorItemPersist) {
  return toAplicadorFirestorePayload(item);
}

export async function deleteAplicadorFirestore(
  uid: string,
  id: string,
  tombstone?: TombstonePayload,
): Promise<void> {
  if (!id) return;
  if (tombstone) {
    await upsertOwnerDoc(
      TABLE,
      uid,
      id,
      tombstoneToCloudDoc({ ...tombstone, id }),
      tombstone.updatedAt,
      true,
    );
    return;
  }
  await deleteOwnerDoc(TABLE, uid, id);
}

export async function purgeAplicadorFirestore(uid: string, id: string): Promise<void> {
  if (!id) return;
  await deleteOwnerDoc(TABLE, uid, id);
}
