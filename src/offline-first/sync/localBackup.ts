import {
  getTafDatabase,
  type CadastroRubricasTableRow,
  type LocalBackupChunkKind,
  type SessaoRubricasTableRow,
} from '../db/tafDatabase';
import type { LocalBackupSnapshot } from '../types';
import { listAplicadores, listCadastros, listSessoes, wipeOwnerData } from '../db/localDb';
import { putAplicadorRecord, putCadastroRecord, putSessaoRecord } from '../db/localDb';
import { yieldToUi } from '../../utils/yieldToUi';

const MAX_BACKUPS = 3;
/** Poucas rúbricas por gravação — o SVG não entra inteiro na memória com o restante. */
const RUBRIC_BACKUP_PAGE = 15;

async function deleteBackupChunks(backupId: number): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const ids = await db.localBackupChunks.where('backupId').equals(backupId).primaryKeys();
  if (ids.length === 0) return;
  await db.localBackupChunks.bulkDelete(ids);
}

async function copyRubricPages(
  backupId: number,
  ownerUid: string,
  kind: LocalBackupChunkKind,
): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const table = kind === 'cadastroRubricas' ? db.cadastroRubricas : db.sessaoRubricas;
  let offset = 0;

  for (;;) {
    const page = await table
      .where('ownerUid')
      .equals(ownerUid)
      .offset(offset)
      .limit(RUBRIC_BACKUP_PAGE)
      .toArray();
    if (page.length === 0) break;
    await db.localBackupChunks.add({ backupId, kind, rows: page });
    offset += page.length;
    if (page.length < RUBRIC_BACKUP_PAGE) break;
    await yieldToUi();
  }
}

async function restoreRubricChunks(backupId: number, kind: LocalBackupChunkKind): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;
  const chunks = await db.localBackupChunks
    .where('[backupId+kind]')
    .equals([backupId, kind])
    .toArray();
  for (const chunk of chunks) {
    const rows = chunk.rows ?? [];
    if (rows.length === 0) continue;
    if (kind === 'cadastroRubricas') {
      await db.cadastroRubricas.bulkPut(rows as CadastroRubricasTableRow[]);
    } else {
      await db.sessaoRubricas.bulkPut(rows as SessaoRubricasTableRow[]);
    }
    await yieldToUi();
  }
}

export async function createLocalBackup(ownerUid: string): Promise<number | null> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return null;

  // Uma coleção por vez — evita o pico de cadastros + sessões + aplicadores juntos.
  const cadastros = await listCadastros(ownerUid, true);
  await yieldToUi();
  const sessoes = await listSessoes(ownerUid, true);
  await yieldToUi();
  const aplicadores = await listAplicadores(ownerUid, true);
  await yieldToUi();

  const snapshot: LocalBackupSnapshot = {
    ownerUid,
    createdAt: Date.now(),
    cadastros,
    sessoes,
    aplicadores,
    cadastroRubricas: [],
    sessaoRubricas: [],
  };

  await pruneOldBackups(ownerUid, MAX_BACKUPS - 1);
  const id = await db.localBackups.add(snapshot);
  await copyRubricPages(id, ownerUid, 'cadastroRubricas');
  await copyRubricPages(id, ownerUid, 'sessaoRubricas');
  return id;
}

export async function restoreLocalBackup(backupId: number): Promise<boolean> {
  const db = getTafDatabase();
  if (!db) return false;

  const snapshot = await db.localBackups.get(backupId);
  if (!snapshot) return false;

  await wipeOwnerData(snapshot.ownerUid);

  for (const row of snapshot.cadastros) {
    await putCadastroRecord(row);
  }
  for (const row of snapshot.sessoes) {
    await putSessaoRecord(row);
  }
  for (const row of snapshot.aplicadores) {
    await putAplicadorRecord(row);
  }
  if (snapshot.cadastroRubricas?.length) {
    await db.cadastroRubricas.bulkPut(snapshot.cadastroRubricas);
  } else {
    await restoreRubricChunks(backupId, 'cadastroRubricas');
  }
  if (snapshot.sessaoRubricas?.length) {
    await db.sessaoRubricas.bulkPut(snapshot.sessaoRubricas);
  } else {
    await restoreRubricChunks(backupId, 'sessaoRubricas');
  }

  return true;
}

export async function pruneOldBackups(ownerUid: string, keep = MAX_BACKUPS): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;

  const all = await db.localBackups.where('ownerUid').equals(ownerUid).sortBy('createdAt');
  const excess = all.length - keep;
  if (excess <= 0) return;

  const toDelete = all.slice(0, excess);
  const ids = toDelete.map((b) => b.id!).filter(Boolean);
  for (const id of ids) {
    await deleteBackupChunks(id);
  }
  await db.localBackups.bulkDelete(ids);
}

export async function getLatestBackupId(ownerUid: string): Promise<number | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const latest = await db.localBackups.where('ownerUid').equals(ownerUid).reverse().first();
  return latest?.id ?? null;
}
