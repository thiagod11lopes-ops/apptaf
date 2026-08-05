import {
  deleteOwnerDoc,
  getOwnerDoc,
  getOwnerDocsByIds,
  listOwnerDocs,
  rowToDoc,
  upsertOwnerDoc,
} from './ownerDocs';
import type { SessaoResultadoRubrica } from '../../utils/sessaoLight';

export type SessaoRubricasPayload = {
  resultados: SessaoResultadoRubrica[];
  aplicadorRubricaSvg?: string;
};

export type SessaoRubricasDoc = SessaoRubricasPayload;

const TABLE = 'sessao_rubricas';

function normalizePayload(doc: Partial<SessaoRubricasPayload>): SessaoRubricasPayload {
  return {
    resultados: Array.isArray(doc.resultados) ? doc.resultados : [],
    ...(doc.aplicadorRubricaSvg?.trim()
      ? { aplicadorRubricaSvg: doc.aplicadorRubricaSvg.trim() }
      : {}),
  };
}

export async function setSessaoRubricasCloud(
  uid: string,
  id: string,
  payload: SessaoRubricasPayload,
): Promise<void> {
  if (payload.resultados.length === 0 && !payload.aplicadorRubricaSvg?.trim()) return;
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
    map.set(row.id, normalizePayload(doc));
  }
  return map;
}

/** Uma linha — nunca varre a tabela inteira. */
export async function getSessaoRubricasCloud(
  uid: string,
  id: string,
): Promise<SessaoRubricasPayload | null> {
  const row = await getOwnerDoc(TABLE, uid, id);
  if (!row) return null;
  const doc = rowToDoc<SessaoRubricasPayload & { id: string }>(row);
  return normalizePayload(doc);
}

export async function getAllSessaoRubricasFirestoreMap(
  uid: string,
): Promise<Map<string, SessaoRubricasDoc>> {
  return getAllSessaoRubricasCloud(uid);
}

/**
 * Baixa rúbricas só dos ids pedidos (lotes `.in`) — nunca full-scan da tabela.
 */
export async function fetchSessaoRubricasForIds(
  uid: string,
  ids: string[],
): Promise<Map<string, SessaoRubricasDoc>> {
  if (ids.length === 0) return new Map();
  const rows = await getOwnerDocsByIds(TABLE, uid, ids);
  const map = new Map<string, SessaoRubricasDoc>();
  for (const [id, row] of rows) {
    const doc = rowToDoc<SessaoRubricasPayload & { id: string }>(row);
    map.set(id, normalizePayload(doc));
  }
  return map;
}
