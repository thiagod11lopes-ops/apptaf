import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import type { TombstonePayload } from '../../offline-first/sync/tombstone';
import { extractSessaoRubricas, toSessaoFromFirestoreDoc, toSessaoLight } from '../../utils/sessaoLight';
import { stampSessao } from '../offline/recordTimestamps';
import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';
import { deleteSessaoRubricasCloud, setSessaoRubricasCloud } from './sessaoRubricasCloud';

const TABLE = 'sessoes';

export async function getAllSessoesFirestoreLight(uid: string): Promise<SessaoAplicacaoTaf[]> {
  const rows = await listOwnerDocs(TABLE, uid);
  const list: SessaoAplicacaoTaf[] = [];
  for (const row of rows) {
    if (row.deleted) continue;
    const raw = rowToDoc<SessaoAplicacaoTaf & { deleted?: boolean }>(row);
    if (raw.deleted) continue;
    list.push(toSessaoFromFirestoreDoc({ ...raw, id: row.id }));
  }
  list.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  return list;
}

export async function getAllSessoesFirestore(uid: string): Promise<SessaoAplicacaoTaf[]> {
  return getAllSessoesFirestoreLight(uid);
}

async function persistSessao(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  const stamped = stampSessao(sessao, sessao.updatedAt);
  const rubricas = extractSessaoRubricas(stamped);
  const light = toSessaoLight(stamped);
  await upsertOwnerDoc(
    TABLE,
    uid,
    stamped.id,
    { ...light, updatedAt: stamped.updatedAt } as Record<string, unknown>,
    stamped.updatedAt ?? Date.now(),
  );
  if (rubricas.length > 0) {
    await setSessaoRubricasCloud(uid, sessao.id, { resultados: rubricas });
  } else {
    await deleteSessaoRubricasCloud(uid, sessao.id);
  }
}

export async function addSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  await persistSessao(uid, sessao);
}

export async function updateSessaoFirestore(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  await persistSessao(uid, sessao);
}

export async function deleteSessaoFirestore(
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
        updatedAt: tombstone.updatedAt,
        deleted: true,
        deletedAt: tombstone.deletedAt,
        deletedBy: tombstone.deletedBy,
      },
      tombstone.updatedAt,
      true,
    );
    return;
  }
  await deleteOwnerDoc(TABLE, uid, id);
  await deleteSessaoRubricasCloud(uid, id);
}

export async function purgeSessaoFirestore(uid: string, id: string): Promise<void> {
  await deleteOwnerDoc(TABLE, uid, id);
  await deleteSessaoRubricasCloud(uid, id);
}
