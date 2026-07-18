/**
 * SyncCheckpoint por owner+collection (Prompt 7.1).
 * Persistido em Dexie meta — sem schema Supabase novo.
 */

import { getMeta, setMeta } from '../db/tafDatabase';
import { getRemoteSyncWatermark } from './syncWatermark';

export type SyncCheckpointCollection = 'cadastros' | 'sessoes' | 'aplicadores';

export type RemoteCursor = {
  updated_at: number;
  id: string;
};

export type SyncCheckpoint = {
  ownerUid: string;
  collection: SyncCheckpointCollection;
  lastSuccessfulSyncAt: number;
  lastRemoteCursor: RemoteCursor | null;
  version: number;
  lastSyncUpperBoundAt?: number;
  lastFetchMode?: 'full' | 'incremental';
};

const COLLECTIONS: SyncCheckpointCollection[] = ['cadastros', 'sessoes', 'aplicadores'];

function checkpointKey(ownerUid: string, collection: SyncCheckpointCollection): string {
  return `sync:checkpoint:${ownerUid}:${collection}`;
}

export function compareRemoteCursor(a: RemoteCursor, b: RemoteCursor): number {
  if (a.updated_at !== b.updated_at) return a.updated_at - b.updated_at;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function maxRemoteCursor(a: RemoteCursor | null, b: RemoteCursor | null): RemoteCursor | null {
  if (!a) return b;
  if (!b) return a;
  return compareRemoteCursor(a, b) >= 0 ? a : b;
}

export async function loadSyncCheckpoint(
  ownerUid: string,
  collection: SyncCheckpointCollection,
): Promise<SyncCheckpoint | null> {
  if (!ownerUid.trim()) return null;
  const raw = await getMeta(checkpointKey(ownerUid, collection));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SyncCheckpoint;
      if (parsed?.ownerUid === ownerUid && parsed.collection === collection) {
        return parsed;
      }
    } catch {
      // fall through to migrate
    }
  }
  return migrateFromLegacyWatermark(ownerUid, collection);
}

async function migrateFromLegacyWatermark(
  ownerUid: string,
  collection: SyncCheckpointCollection,
): Promise<SyncCheckpoint | null> {
  const watermark = await getRemoteSyncWatermark(ownerUid);
  if (watermark == null || watermark <= 0) return null;
  const seeded: SyncCheckpoint = {
    ownerUid,
    collection,
    lastSuccessfulSyncAt: watermark,
    lastRemoteCursor: null,
    version: 1,
    lastFetchMode: 'full',
  };
  await saveSyncCheckpoint(seeded);
  return seeded;
}

export async function saveSyncCheckpoint(checkpoint: SyncCheckpoint): Promise<void> {
  if (!checkpoint.ownerUid.trim()) return;
  await setMeta(checkpointKey(checkpoint.ownerUid, checkpoint.collection), JSON.stringify(checkpoint));
}

/** Commit atômico por coleção após sync íntegro. */
export async function commitSyncCheckpoint(
  ownerUid: string,
  collection: SyncCheckpointCollection,
  cursor: RemoteCursor | null,
  upperBoundAt: number,
  fetchMode: 'full' | 'incremental',
): Promise<SyncCheckpoint> {
  const prev = await loadSyncCheckpoint(ownerUid, collection);
  const next: SyncCheckpoint = {
    ownerUid,
    collection,
    lastSuccessfulSyncAt: Date.now(),
    lastRemoteCursor: cursor,
    version: (prev?.version ?? 0) + 1,
    lastSyncUpperBoundAt: upperBoundAt,
    lastFetchMode: fetchMode,
  };
  await saveSyncCheckpoint(next);
  return next;
}

export async function commitAllCollectionCheckpoints(
  ownerUid: string,
  cursors: Partial<Record<SyncCheckpointCollection, RemoteCursor | null>>,
  upperBoundAt: number,
  fetchMode: 'full' | 'incremental',
): Promise<void> {
  for (const collection of COLLECTIONS) {
    await commitSyncCheckpoint(
      ownerUid,
      collection,
      cursors[collection] ?? null,
      upperBoundAt,
      fetchMode,
    );
  }
}

export { COLLECTIONS as SYNC_CHECKPOINT_COLLECTIONS };
