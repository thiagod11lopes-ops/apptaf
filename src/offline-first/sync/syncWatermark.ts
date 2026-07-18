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

/** Intervalo máximo entre full fetches — autocorrige qualquer delta perdido (ex.: relógio torto). */
export const FULL_FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000;

function fullFetchKey(ownerUid: string): string {
  return `sync:lastFullFetch:${ownerUid}`;
}

export async function markFullFetchDone(ownerUid: string): Promise<void> {
  if (!ownerUid.trim()) return;
  await setMeta(fullFetchKey(ownerUid), String(Date.now()));
}

/** Verdadeiro quando nunca houve full fetch ou o último passou do intervalo. */
export async function isFullFetchDue(ownerUid: string): Promise<boolean> {
  const raw = await getMeta(fullFetchKey(ownerUid));
  const at = raw ? Number(raw) : NaN;
  if (!Number.isFinite(at) || at <= 0) return true;
  return Date.now() - at >= FULL_FETCH_INTERVAL_MS;
}
