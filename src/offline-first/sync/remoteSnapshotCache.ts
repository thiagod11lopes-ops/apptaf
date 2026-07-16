import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CollectionName, PreCadastroRecord } from '../types';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { toCadastroLight } from '../../utils/cadastroLight';
import { toSessaoFromFirestoreDoc } from '../../utils/sessaoLight';
import { stripSenhaFromAplicador } from '../../utils/aplicadorSyncPolicy';
import {
  listCadastrosForSync,
  listSessoesForSync,
  listAplicadoresForSync,
} from '../db/localDb';
import { isUnsyncedLocalStatus } from './syncStatus';
import { getRemoteSyncWatermark } from './syncWatermark';
import {
  getAllAplicadoresFirestore,
  getAplicadoresFirestoreSince,
} from '../../services/supabase/aplicadoresCloud';
import {
  getAllCadastrosFirestoreLight,
  getCadastrosFirestoreSince,
} from '../../services/supabase/cadastrosCloud';
import {
  getAllSessoesFirestoreLight,
  getSessoesFirestoreSince,
} from '../../services/supabase/sessoesCloud';

export type RemoteCollectionsSnapshot = {
  ownerUid: string;
  fetchedAt: number;
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
  remotePre: PreCadastroRecord[];
};

/** TTL do snapshot em memória — evita baixar tudo a cada comparação. */
export const REMOTE_SNAPSHOT_TTL_MS = 180_000;

let cached: RemoteCollectionsSnapshot | null = null;

export function invalidateRemoteSnapshotCache(): void {
  cached = null;
}

export function peekRemoteSnapshotCache(ownerUid: string): RemoteCollectionsSnapshot | null {
  if (!cached || cached.ownerUid !== ownerUid) return null;
  if (Date.now() - cached.fetchedAt >= REMOTE_SNAPSHOT_TTL_MS) return null;
  return cached;
}

function remotePermissionMessage(collection: CollectionName, ownerUid: string): string {
  if (collection === 'pre_cadastros') {
    return 'Permissão negada na coleção pre_cadastros. Verifique as policies RLS no Supabase.';
  }
  const loginUid = getCachedLoginUid();
  if (loginUid && loginUid !== ownerUid) {
    return `Permissão negada ao ler ${collection} do chefe. Confirme que seu e-mail está autorizado.`;
  }
  return `Permissão negada ao ler ${collection} na nuvem. Verifique as policies RLS no Supabase.`;
}

async function fetchRemoteCollection<T>(
  collection: CollectionName,
  ownerUid: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/permission|permiss[aã]o|denied|insufficient/i.test(msg)) {
      throw new Error(remotePermissionMessage(collection, ownerUid));
    }
    throw error;
  }
}

function mergeById<T extends { id: string }>(baseline: T[], delta: T[]): T[] {
  const map = new Map<string, T>();
  for (const row of baseline) map.set(row.id, row);
  for (const row of delta) map.set(row.id, row);
  return [...map.values()];
}

/** Baseline remoto a partir do IndexedDB já sincronizado (evita full fetch). */
async function buildRemoteBaselineFromLocal(ownerUid: string): Promise<{
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
}> {
  const [localCad, localSess, localApp] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
  ]);

  const remoteCad: CadastroItemPersist[] = [];
  for (const row of localCad) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    remoteCad.push(toCadastroLight(row as CadastroItemPersist));
  }

  const remoteSess: SessaoAplicacaoTaf[] = [];
  for (const row of localSess) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    remoteSess.push(toSessaoFromFirestoreDoc(row as SessaoAplicacaoTaf & { id: string }));
  }

  const remoteApp: AplicadorItemPersist[] = [];
  for (const row of localApp) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    remoteApp.push(stripSenhaFromAplicador(row as AplicadorItemPersist));
  }

  return { remoteCad, remoteSess, remoteApp };
}

export async function fetchRemoteCollectionsSnapshot(
  ownerUid: string,
  force = false,
): Promise<RemoteCollectionsSnapshot> {
  const fresh = peekRemoteSnapshotCache(ownerUid);
  if (!force && fresh) return fresh;

  const watermark = force ? null : await getRemoteSyncWatermark(ownerUid);

  if (watermark != null && watermark > 0) {
    const since = Math.max(0, watermark - 15_000);
    const [deltaCad, deltaSess, deltaApp] = await Promise.all([
      fetchRemoteCollection('cadastros', ownerUid, () => getCadastrosFirestoreSince(ownerUid, since)),
      fetchRemoteCollection('sessoes', ownerUid, () => getSessoesFirestoreSince(ownerUid, since)),
      fetchRemoteCollection('aplicadores', ownerUid, () => getAplicadoresFirestoreSince(ownerUid, since)),
    ]);

    if (deltaCad.length + deltaSess.length + deltaApp.length === 0) {
      const baseline = await buildRemoteBaselineFromLocal(ownerUid);
      cached = {
        ownerUid,
        fetchedAt: Date.now(),
        ...baseline,
        remotePre: [],
      };
      return cached;
    }

    const baseline = await buildRemoteBaselineFromLocal(ownerUid);
    cached = {
      ownerUid,
      fetchedAt: Date.now(),
      remoteCad: mergeById(baseline.remoteCad, deltaCad),
      remoteSess: mergeById(baseline.remoteSess, deltaSess),
      remoteApp: mergeById(baseline.remoteApp, deltaApp),
      remotePre: [],
    };
    return cached;
  }

  const [remoteCad, remoteSess, remoteApp] = await Promise.all([
    fetchRemoteCollection('cadastros', ownerUid, () => getAllCadastrosFirestoreLight(ownerUid)),
    fetchRemoteCollection('sessoes', ownerUid, () => getAllSessoesFirestoreLight(ownerUid)),
    fetchRemoteCollection('aplicadores', ownerUid, () => getAllAplicadoresFirestore(ownerUid)),
  ]);

  cached = {
    ownerUid,
    fetchedAt: Date.now(),
    remoteCad,
    remoteSess,
    remoteApp,
    remotePre: [],
  };
  return cached;
}
