import { getMeta, setMeta } from '../db/tafDatabase';
import { getLastSuccessfulSyncAudit } from './syncAudit';

function watermarkKey(ownerUid: string): string {
  return `sync:remoteWatermark:${ownerUid}`;
}

/** Marca de tempo da última sync bem-sucedida (para fetch incremental). */
export async function getRemoteSyncWatermark(ownerUid: string): Promise<number | null> {
  const raw = await getMeta(watermarkKey(ownerUid));
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const audit = await getLastSuccessfulSyncAudit(ownerUid);
  return audit?.finishedAt ?? null;
}

export async function setRemoteSyncWatermark(ownerUid: string, atMs: number): Promise<void> {
  if (!ownerUid.trim() || !Number.isFinite(atMs)) return;
  await setMeta(watermarkKey(ownerUid), String(Math.round(atMs)));
}
