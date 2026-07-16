import { deleteOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';
import type { CadastroRubricas } from '../../utils/cadastroLight';

export type CadastroRubricasPayload = CadastroRubricas;

const TABLE = 'cadastro_rubricas';
const RUBRIC_BATCH_THRESHOLD = 4;

export async function setCadastroRubricasCloud(
  uid: string,
  id: string,
  rubricas: CadastroRubricasPayload,
): Promise<void> {
  await upsertOwnerDoc(TABLE, uid, id, rubricas as Record<string, unknown>, Date.now());
}

export async function deleteCadastroRubricasCloud(uid: string, id: string): Promise<void> {
  await deleteOwnerDoc(TABLE, uid, id);
}

export async function getAllCadastroRubricasCloud(
  uid: string,
): Promise<Map<string, CadastroRubricasPayload>> {
  const rows = await listOwnerDocs(TABLE, uid);
  const map = new Map<string, CadastroRubricasPayload>();
  for (const row of rows) {
    map.set(row.id, rowToDoc<CadastroRubricasPayload & { id: string }>(row));
  }
  return map;
}

export async function getCadastroRubricasCloud(
  uid: string,
  id: string,
): Promise<CadastroRubricasPayload | null> {
  const all = await getAllCadastroRubricasCloud(uid);
  return all.get(id) ?? null;
}

export async function getAllCadastroRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, CadastroRubricas>> {
  return getAllCadastroRubricasCloud(uid);
}

export async function fetchCadastroRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, CadastroRubricas>> {
  if (ids.length === 0) return new Map();
  if (ids.length <= RUBRIC_BATCH_THRESHOLD) {
    const pairs = await Promise.all(
      ids.map(async (id) => {
        const rub = await getCadastroRubricasCloud(uid, id);
        return rub ? ([id, rub] as const) : null;
      }),
    );
    return new Map(pairs.filter((p): p is [string, CadastroRubricas] => p != null));
  }
  const all = await getAllCadastroRubricasCloud(uid);
  const picked = new Map<string, CadastroRubricas>();
  for (const id of ids) {
    const rub = all.get(id);
    if (rub) picked.set(id, rub);
  }
  return picked;
}
