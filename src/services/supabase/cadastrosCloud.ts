import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import { tombstoneToCloudDoc, type TombstonePayload } from '../../offline-first/sync/tombstone';
import { formatNipInput, nipChaveCadastro } from '../../utils/nipFormat';
import { stampCadastro } from '../offline/recordTimestamps';
import {
  extractCadastroRubricas,
  hasCadastroRubricas,
  toCadastroLight,
} from '../../utils/cadastroLight';
import { deleteOwnerDoc, listOwnerDocs, listOwnerDocsSince, rowToDoc, upsertOwnerDoc } from './ownerDocs';
import {
  deleteCadastroRubricasCloud,
  setCadastroRubricasCloud,
} from './cadastroRubricasCloud';

const TABLE = 'cadastros';

export async function getAllCadastrosFirestoreLight(uid: string): Promise<CadastroItemPersist[]> {
  const rows = await listOwnerDocs(TABLE, uid);
  return rowsToCadastrosLight(rows);
}

export async function getAllCadastrosFirestore(uid: string): Promise<CadastroItemPersist[]> {
  return getAllCadastrosFirestoreLight(uid);
}

function rowsToCadastrosLight(rows: Awaited<ReturnType<typeof listOwnerDocs>>): CadastroItemPersist[] {
  const items: CadastroItemPersist[] = [];
  for (const row of rows) {
    if (row.deleted) continue;
    const raw = rowToDoc<CadastroItemPersist & { deleted?: boolean }>(row);
    if (raw.deleted) continue;
    const nipDigits = nipChaveCadastro(raw.nip);
    items.push(
      toCadastroLight({
        ...raw,
        id: row.id,
        nome: (raw.nome ?? '').trim(),
        nip: nipDigits ? formatNipInput(nipDigits) : (raw.nip ?? '').trim(),
      }),
    );
  }
  // Sem dedupe por NIP aqui: o LWW compara por id. Dedupe só na UI (listCadastrosForDisplay).
  return items;
}

export async function getCadastrosFirestoreSince(
  uid: string,
  sinceUpdatedAt: number,
): Promise<CadastroItemPersist[]> {
  const rows = await listOwnerDocsSince(TABLE, uid, sinceUpdatedAt);
  return rowsToCadastrosLight(rows);
}

async function persistCadastro(uid: string, item: CadastroItemPersist): Promise<void> {
  const stamped = stampCadastro(item, item.updatedAt);
  const rubricas = extractCadastroRubricas(stamped);
  const light = toCadastroLight(stamped);
  await upsertOwnerDoc(TABLE, uid, stamped.id, { ...light, updatedAt: stamped.updatedAt }, stamped.updatedAt ?? Date.now());
  if (hasCadastroRubricas(rubricas)) {
    await setCadastroRubricasCloud(uid, item.id, rubricas);
  } else {
    await deleteCadastroRubricasCloud(uid, item.id);
  }
}

export async function addCadastroFirestore(uid: string, item: CadastroItemPersist): Promise<void> {
  await persistCadastro(uid, item);
}

export async function addCadastrosEmLoteFirestore(
  uid: string,
  items: CadastroItemPersist[],
): Promise<void> {
  for (const item of items) {
    await persistCadastro(uid, item);
  }
}

export async function deleteCadastroFirestore(
  uid: string,
  id: string,
  tombstone?: TombstonePayload,
): Promise<void> {
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
  await deleteCadastroRubricasCloud(uid, id);
}

export async function purgeCadastroFirestore(uid: string, id: string): Promise<void> {
  await deleteOwnerDoc(TABLE, uid, id);
  await deleteCadastroRubricasCloud(uid, id);
}
