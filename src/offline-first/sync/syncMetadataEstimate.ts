import { getCachedLoginUid } from '../../services/firebase/authUid';
import {
  listOwnerDocMetadata,
  type OwnerDocMetadata,
} from '../../services/supabase/ownerDocs';
import { ANONYMOUS_OWNER } from '../db/localDb';
import { getTafDatabase } from '../db/tafDatabase';
import type { CollectionName } from '../types';
import { readUpdatedAt } from './recordMeta';
import { isUnsyncedLocalStatus } from './syncStatus';
import type { SyncQueueBreakdown, SyncQueueCategory } from './syncQueueBreakdown';

type SyncHead = {
  id: string;
  updatedAt: number;
  deleted: boolean;
  unsynced: boolean;
};

const META_COLLECTIONS: Array<{
  collection: Extract<CollectionName, 'cadastros' | 'sessoes' | 'aplicadores'>;
  label: string;
  table: 'cadastros' | 'sessoes' | 'aplicadores';
}> = [
  { collection: 'cadastros', label: 'Cadastros', table: 'cadastros' },
  { collection: 'sessoes', label: 'Testes físicos', table: 'sessoes' },
  { collection: 'aplicadores', label: 'Aplicadores', table: 'aplicadores' },
];

function ownerSources(ownerUid: string): string[] {
  const loginUid = getCachedLoginUid();
  const sources = [ownerUid, ANONYMOUS_OWNER];
  if (loginUid && loginUid !== ownerUid && !sources.includes(loginUid)) {
    sources.push(loginUid);
  }
  return sources;
}

/**
 * Quantos registros a nuvem tem mais novos (ou ausentes aqui).
 * Não conta ausência local na nuvem — isso o sync real resolve sem esta leitura.
 */
export function countMetadataDownloads(
  local: Map<string, SyncHead>,
  remote: OwnerDocMetadata[],
): number {
  let downloads = 0;
  for (const row of remote) {
    const here = local.get(row.id);
    if (!here) {
      if (!row.deleted) downloads += 1;
      continue;
    }
    if (row.updated_at > here.updatedAt) downloads += 1;
  }
  return downloads;
}

async function collectLocalHeads(
  table: 'cadastros' | 'sessoes' | 'aplicadores',
  ownerUid: string,
): Promise<{ heads: Map<string, SyncHead>; unsynced: number }> {
  const db = getTafDatabase();
  const heads = new Map<string, SyncHead>();
  if (!db) return { heads, unsynced: 0 };

  for (const uid of ownerSources(ownerUid)) {
    await db[table].where('ownerUid').equals(uid).each((row) => {
      const head: SyncHead = {
        id: row.id,
        updatedAt: readUpdatedAt(row),
        deleted: row.deleted === true,
        unsynced: isUnsyncedLocalStatus(row.syncStatus),
      };
      const prev = heads.get(row.id);
      if (!prev || head.unsynced || head.updatedAt >= prev.updatedAt) {
        heads.set(row.id, head);
      }
    });
  }

  let unsynced = 0;
  for (const head of heads.values()) {
    if (head.unsynced) unsynced += 1;
  }
  return { heads, unsynced };
}

/** Estima a fila só com id e data. Não descriptografa e não lê rúbrica. */
export async function estimateSyncQueueFromMetadata(ownerUid: string): Promise<{
  pendingUploads: number;
  pendingDownloads: number;
  downloadBreakdown: SyncQueueBreakdown;
}> {
  const remoteLists = await Promise.all(
    META_COLLECTIONS.map((entry) => listOwnerDocMetadata(entry.table, ownerUid)),
  );

  const categories: SyncQueueCategory[] = [];
  let pendingDownloads = 0;
  let pendingUploads = 0;

  for (let i = 0; i < META_COLLECTIONS.length; i += 1) {
    const entry = META_COLLECTIONS[i]!;
    const remote = remoteLists[i] ?? [];
    const local = await collectLocalHeads(entry.table, ownerUid);
    const downloads = countMetadataDownloads(local.heads, remote);
    pendingUploads += local.unsynced;
    pendingDownloads += downloads;
    if (downloads > 0) {
      categories.push({ key: entry.collection, label: entry.label, count: downloads });
    }
  }

  return {
    pendingUploads,
    pendingDownloads,
    downloadBreakdown: { total: pendingDownloads, categories },
  };
}
