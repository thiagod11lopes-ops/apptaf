import {
  deleteOwnerDoc,
  getOwnerDoc,
  getOwnerDocsByIds,
  listOwnerDocs,
  rowToDoc,
  upsertOwnerDoc,
} from './ownerDocs';
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
 * Baixa rúbricas só dos ids pedidos (lotes `.in`) — nunca full-scan da tabela.
 */
export async function fetchCadastroRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, CadastroRubricas>> {
  if (ids.length === 0) return new Map();
  const rows = await getOwnerDocsByIds(TABLE, uid, ids);
  const map = new Map<string, CadastroRubricas>();
  for (const [id, row] of rows) {
    map.set(id, rowToDoc<CadastroRubricasPayload & { id: string }>(row));
  }
  return map;
}
