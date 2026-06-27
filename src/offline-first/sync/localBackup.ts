import { getTafDatabase } from '../db/tafDatabase';
import type { LocalBackupSnapshot } from '../types';
import { listAplicadores, listCadastros, listSessoes, wipeOwnerData } from '../db/localDb';
import { putAplicadorRecord, putCadastroRecord, putSessaoRecord } from '../db/localDb';

const MAX_BACKUPS = 10;

export async function createLocalBackup(ownerUid: string): Promise<number | null> {
  const db = getTafDatabase();
  if (!db || !ownerUid.trim()) return null;

  const [cadastros, sessoes, aplicadores] = await Promise.all([
    listCadastros(ownerUid, true),
    listSessoes(ownerUid, true),
    listAplicadores(ownerUid, true),
  ]);

  const snapshot: LocalBackupSnapshot = {
    ownerUid,
    createdAt: Date.now(),
    cadastros,
    sessoes,
    aplicadores,
  };

  const id = await db.localBackups.add(snapshot);
  await pruneOldBackups(ownerUid, MAX_BACKUPS);
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

  return true;
}

export async function pruneOldBackups(ownerUid: string, keep = MAX_BACKUPS): Promise<void> {
  const db = getTafDatabase();
  if (!db) return;

  const all = await db.localBackups.where('ownerUid').equals(ownerUid).sortBy('createdAt');
  const excess = all.length - keep;
  if (excess <= 0) return;

  const toDelete = all.slice(0, excess);
  await db.localBackups.bulkDelete(toDelete.map((b) => b.id!).filter(Boolean));
}

export async function getLatestBackupId(ownerUid: string): Promise<number | null> {
  const db = getTafDatabase();
  if (!db) return null;
  const latest = await db.localBackups.where('ownerUid').equals(ownerUid).reverse().first();
  return latest?.id ?? null;
}
