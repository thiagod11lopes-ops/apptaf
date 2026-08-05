import type { CadastroRubricas } from '../../utils/cadastroLight';
import type { SessaoResultadoRubrica } from '../../utils/sessaoLight';
import { hasCadastroRubricas } from '../../utils/cadastroLight';
import { isRubricaImagemDataUrl } from '../../utils/rubricaPresence';
import { getTafDatabase } from './tafDatabase';

export type CadastroRubricasRecord = CadastroRubricas & {
  id: string;
  ownerUid: string;
  updatedAt: number;
};

export type SessaoRubricasRecord = {
  id: string;
  ownerUid: string;
  updatedAt: number;
  resultados: SessaoResultadoRubrica[];
  /** Rúbrica do aplicador (ficava embutida em aplicadorAssinatura). */
  aplicadorRubricaSvg?: string;
};

export async function putCadastroRubricasLocal(
  ownerUid: string,
  id: string,
  rubricas: CadastroRubricas,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  if (!hasCadastroRubricas(rubricas)) {
    await db.cadastroRubricas.delete(id);
    return;
  }
  const row: CadastroRubricasRecord = {
    id,
    ownerUid,
    updatedAt: Date.now(),
    rubricaCorridaSvg: rubricas.rubricaCorridaSvg,
    rubricaNatacaoSvg: rubricas.rubricaNatacaoSvg,
    rubricaCaminhadaSvg: rubricas.rubricaCaminhadaSvg,
    rubricaPermanenciaSvg: rubricas.rubricaPermanenciaSvg,
  };
  await db.cadastroRubricas.put(row);
}

export async function getCadastroRubricasLocal(
  id: string,
): Promise<CadastroRubricas | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const row = await db.cadastroRubricas.get(id);
  if (!row) return null;
  return {
    rubricaCorridaSvg: row.rubricaCorridaSvg,
    rubricaNatacaoSvg: row.rubricaNatacaoSvg,
    rubricaCaminhadaSvg: row.rubricaCaminhadaSvg,
    rubricaPermanenciaSvg: row.rubricaPermanenciaSvg,
  };
}

export async function getCadastroRubricasLocalByIds(
  ids: string[],
): Promise<Map<string, CadastroRubricas>> {
  const map = new Map<string, CadastroRubricas>();
  const db = getTafDatabase();
  if (!db || ids.length === 0) return map;
  const unique = [...new Set(ids.filter(Boolean))];
  const rows = await db.cadastroRubricas.bulkGet(unique);
  for (const row of rows) {
    if (!row) continue;
    map.set(row.id, {
      rubricaCorridaSvg: row.rubricaCorridaSvg,
      rubricaNatacaoSvg: row.rubricaNatacaoSvg,
      rubricaCaminhadaSvg: row.rubricaCaminhadaSvg,
      rubricaPermanenciaSvg: row.rubricaPermanenciaSvg,
    });
  }
  return map;
}

export async function putSessaoRubricasLocal(
  ownerUid: string,
  id: string,
  payload: {
    resultados: SessaoResultadoRubrica[];
    aplicadorRubricaSvg?: string;
  },
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const resultados = (payload.resultados ?? []).filter((r) =>
    isRubricaImagemDataUrl(r.rubricaCandidatoSvg),
  );
  const aplicador = isRubricaImagemDataUrl(payload.aplicadorRubricaSvg)
    ? payload.aplicadorRubricaSvg!.trim()
    : undefined;
  if (resultados.length === 0 && !aplicador) {
    await db.sessaoRubricas.delete(id);
    return;
  }
  const row: SessaoRubricasRecord = {
    id,
    ownerUid,
    updatedAt: Date.now(),
    resultados,
    ...(aplicador ? { aplicadorRubricaSvg: aplicador } : {}),
  };
  await db.sessaoRubricas.put(row);
}

export async function getSessaoRubricasLocal(
  id: string,
): Promise<SessaoRubricasRecord | null> {
  const db = getTafDatabase();
  if (!db) return null;
  return (await db.sessaoRubricas.get(id)) ?? null;
}

export async function listSessaoRubricasLocal(
  ownerUid: string,
): Promise<SessaoRubricasRecord[]> {
  const db = getTafDatabase();
  if (!db) return [];
  return db.sessaoRubricas.where('ownerUid').equals(ownerUid).toArray();
}

export async function deleteSessaoRubricasLocal(id: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.sessaoRubricas.delete(id);
}

export async function deleteCadastroRubricasLocal(id: string): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  await db.cadastroRubricas.delete(id);
}
