import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';
import type { SessaoResultadoRubrica } from '../../utils/sessaoLight';

export type SessaoRubricasPayload = {
  resultados: SessaoResultadoRubrica[];
};

export type SessaoRubricasDoc = SessaoRubricasPayload;

const TABLE = 'sessao_rubricas';
const RUBRIC_BATCH_THRESHOLD = 4;

export async function setSessaoRubricasCloud(
  uid: string,
  id: string,
  payload: SessaoRubricasPayload,
): Promise<void> {
  if (payload.resultados.length === 0) return;
  await upsertOwnerDoc(TABLE, uid, id, payload as unknown as Record<string, unknown>, Date.now());
}

export async function deleteSessaoRubricasCloud(uid: string, id: string): Promise<void> {
  await deleteOwnerDoc(TABLE, uid, id);
}

export async function getAllSessaoRubricasCloud(
  uid: string,
): Promise<Map<string, SessaoRubricasPayload>> {
  const rows = await listOwnerDocs(TABLE, uid);
  const map = new Map<string, SessaoRubricasPayload>();
  for (const row of rows) {
    const doc = rowToDoc<SessaoRubricasPayload & { id: string }>(row);
    map.set(row.id, { resultados: Array.isArray(doc.resultados) ? doc.resultados : [] });
  }
  return map;
}

export async function getSessaoRubricasCloud(
  uid: string,
  id: string,
): Promise<SessaoRubricasPayload | null> {
  const all = await getAllSessaoRubricasCloud(uid);
  return all.get(id) ?? null;
}

export async function getAllSessaoRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, SessaoRubricasDoc>> {
  return getAllSessaoRubricasCloud(uid);
}

export async function fetchSessaoRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, SessaoRubricasDoc>> {
  if (ids.length === 0) return new Map();
  if (ids.length <= RUBRIC_BATCH_THRESHOLD) {
    const pairs = await Promise.all(
      ids.map(async (id) => {
        const rub = await getSessaoRubricasCloud(uid, id);
        return rub ? ([id, rub] as const) : null;
      }),
    );
    return new Map(pairs.filter((p): p is [string, SessaoRubricasDoc] => p != null));
  }
  const all = await getAllSessaoRubricasCloud(uid);
  const picked = new Map<string, SessaoRubricasDoc>();
  for (const id of ids) {
    const rub = all.get(id);
    if (rub) picked.set(id, rub);
  }
  return picked;
}
