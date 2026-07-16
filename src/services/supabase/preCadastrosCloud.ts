import type { PreCadastroRecord } from '../../offline-first/types';
import type { TombstonePayload } from '../../offline-first/sync/tombstone';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';

const TABLE = 'pre_cadastros';

export async function getAllPreCadastrosFirestore(uid: string): Promise<PreCadastroRecord[]> {
  const rows = await listOwnerDocs(TABLE, uid);
  return rows.map((row) => {
    const raw = rowToDoc<PreCadastroRecord>(row);
    return { ...raw, id: row.id, ownerUid: uid };
  });
}

export async function addPreCadastroFirestore(uid: string, item: PreCadastroRecord): Promise<void> {
  await upsertOwnerDoc(
    TABLE,
    uid,
    item.id,
    {
      id: item.id,
      criadoEm: item.criadoEm,
      tipoProva: item.tipoProva,
      participantes: item.participantes,
      updatedAt: item.updatedAt,
      syncVersion: item.syncVersion ?? item.version,
      deleted: item.deleted === true,
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy,
      deviceId: item.deviceId,
      updatedBy: item.updatedBy,
    },
    item.updatedAt ?? Date.now(),
    item.deleted === true,
  );
}

export async function deletePreCadastroFirestore(
  uid: string,
  id: string,
  tombstone?: TombstonePayload,
): Promise<void> {
  if (tombstone) {
    await upsertOwnerDoc(
      TABLE,
      uid,
      id,
      {
        id,
        criadoEm: tombstone.updatedAt,
        tipoProva: 'corrida',
        participantes: [],
        updatedAt: tombstone.updatedAt,
        deleted: true,
        deletedAt: tombstone.deletedAt ?? tombstone.updatedAt,
        deletedBy: tombstone.deletedBy,
        syncVersion: tombstone.syncVersion,
        updatedBy: tombstone.updatedBy,
        deviceId: tombstone.deviceId,
      },
      tombstone.updatedAt,
      true,
    );
    return;
  }
  await deleteOwnerDoc(TABLE, uid, id);
}
