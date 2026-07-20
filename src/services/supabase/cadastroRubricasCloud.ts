import { deleteOwnerDoc, getOwnerDoc, listOwnerDocs, rowToDoc, upsertOwnerDoc } from './ownerDocs';
import type { CadastroRubricas } from '../../utils/cadastroLight';

export type CadastroRubricasPayload = CadastroRubricas;

const TABLE = 'cadastro_rubricas';

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

/** Uma linha — nunca varre a tabela inteira. */
export async function getCadastroRubricasCloud(
  uid: string,
  id: string,
): Promise<CadastroRubricasPayload | null> {
  const row = await getOwnerDoc(TABLE, uid, id);
  if (!row) return null;
  return rowToDoc<CadastroRubricasPayload & { id: string }>(row);
}

export async function getAllCadastroRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, CadastroRubricas>> {
  return getAllCadastroRubricasCloud(uid);
}

/**
 * Baixa rubricas para os ids pedidos.
 * Muitos ids → 1 full fetch. Poucos → get por id (sem N×full-table).
 */
export async function fetchCadastroRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, CadastroRubricas>> {
  if (ids.length === 0) return new Map();
  if (ids.length <= 8) {
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
