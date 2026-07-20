import type { CadastroItemPersist } from '../../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../../services/resultadosAplicadosIndexedDb';
import type { CollectionName, PreCadastroRecord } from '../types';
import type { TombstonePayload } from './tombstone';
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
import { getRemoteSyncWatermark, isFullFetchDue } from './syncWatermark';
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
import {
  listAplicadoresTombstonesForSync,
  listAplicadoresTombstonesSinceForSync,
  listCadastrosTombstonesForSync,
  listCadastrosTombstonesSinceForSync,
  listSessoesTombstonesForSync,
  listSessoesTombstonesSinceForSync,
} from '../../services/supabase/cloudTombstonesForSync';

export type RemoteTombstoneCollection = 'cadastros' | 'sessoes' | 'aplicadores';

export type RemoteCollectionsSnapshot = {
  ownerUid: string;
  fetchedAt: number;
  /** 'full' = todas as linhas baixadas; 'incremental' = baseline local + deltas desde o watermark. */
  fetchMode: 'full' | 'incremental';
  /** Registros ativos na nuvem (deleted filtrado — inalterado para UI/LWW atual). */
  remoteCad: CadastroItemPersist[];
  remoteSess: SessaoAplicacaoTaf[];
  remoteApp: AplicadorItemPersist[];
  remotePre: PreCadastroRecord[];
  /** Tombstones remotos — preparação para o sync distinguir ausência de exclusão. */
  remoteCadTombstones: TombstonePayload[];
  remoteSessTombstones: TombstonePayload[];
  remoteAppTombstones: TombstonePayload[];
};

/** TTL do snapshot em memória — evita baixar tudo a cada comparação. */
export const REMOTE_SNAPSHOT_TTL_MS = 180_000;

let cached: RemoteCollectionsSnapshot | null = null;

const EMPTY_TOMBSTONES = {
  remoteCadTombstones: [] as TombstonePayload[],
  remoteSessTombstones: [] as TombstonePayload[],
  remoteAppTombstones: [] as TombstonePayload[],
};

export function invalidateRemoteSnapshotCache(): void {
  cached = null;
}

export function peekRemoteSnapshotCache(ownerUid: string): RemoteCollectionsSnapshot | null {
  if (!cached || cached.ownerUid !== ownerUid) return null;
  if (Date.now() - cached.fetchedAt >= REMOTE_SNAPSHOT_TTL_MS) return null;
  return cached;
}

/** Indica se o id existe como tombstone no snapshot remoto (não como registro ativo). */
export function isRemoteTombstone(
  snapshot: RemoteCollectionsSnapshot,
  collection: RemoteTombstoneCollection,
  id: string,
): boolean {
  return findRemoteTombstone(snapshot, collection, id) != null;
}

export function findRemoteTombstone(
  snapshot: RemoteCollectionsSnapshot,
  collection: RemoteTombstoneCollection,
  id: string,
): TombstonePayload | undefined {
  const list =
    collection === 'cadastros'
      ? snapshot.remoteCadTombstones
      : collection === 'sessoes'
        ? snapshot.remoteSessTombstones
        : snapshot.remoteAppTombstones;
  return list.find((row) => row.id === id);
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

function localRowToSyncTombstone(row: {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
  syncVersion?: number;
  version?: number;
  updatedBy?: string;
  deviceId?: string;
}): TombstonePayload | null {
  if (row.deleted !== true) return null;
  return {
    id: row.id,
    updatedAt: row.updatedAt,
    deleted: true,
    deletedAt: row.deletedAt ?? row.updatedAt,
    deletedBy: row.deletedBy,
    syncVersion: row.syncVersion ?? row.version,
    updatedBy: row.updatedBy,
    deviceId: row.deviceId,
  };
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
    if (isUnsyncedLocalStatus(row.syncStatus) || row.deleted) continue;
    remoteCad.push(toCadastroLight(row as CadastroItemPersist));
  }

  const remoteSess: SessaoAplicacaoTaf[] = [];
  for (const row of localSess) {
    if (isUnsyncedLocalStatus(row.syncStatus) || row.deleted) continue;
    remoteSess.push(toSessaoFromFirestoreDoc(row as SessaoAplicacaoTaf & { id: string }));
  }

  const remoteApp: AplicadorItemPersist[] = [];
  for (const row of localApp) {
    if (isUnsyncedLocalStatus(row.syncStatus) || row.deleted) continue;
    remoteApp.push(stripSenhaFromAplicador(row as AplicadorItemPersist));
  }

  return { remoteCad, remoteSess, remoteApp };
}

/** Tombstones já conhecidos localmente (synced + deleted). */
async function buildTombstoneBaselineFromLocal(ownerUid: string): Promise<{
  remoteCadTombstones: TombstonePayload[];
  remoteSessTombstones: TombstonePayload[];
  remoteAppTombstones: TombstonePayload[];
}> {
  const [localCad, localSess, localApp] = await Promise.all([
    listCadastrosForSync(ownerUid, true),
    listSessoesForSync(ownerUid, true),
    listAplicadoresForSync(ownerUid, true),
  ]);

  const remoteCadTombstones: TombstonePayload[] = [];
  for (const row of localCad) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    const tombstone = localRowToSyncTombstone(row);
    if (tombstone) remoteCadTombstones.push(tombstone);
  }

  const remoteSessTombstones: TombstonePayload[] = [];
  for (const row of localSess) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    const tombstone = localRowToSyncTombstone(row);
    if (tombstone) remoteSessTombstones.push(tombstone);
  }

  const remoteAppTombstones: TombstonePayload[] = [];
  for (const row of localApp) {
    if (isUnsyncedLocalStatus(row.syncStatus)) continue;
    const tombstone = localRowToSyncTombstone(row);
    if (tombstone) remoteAppTombstones.push(tombstone);
  }

  return { remoteCadTombstones, remoteSessTombstones, remoteAppTombstones };
}

/** Margem de segurança do fetch incremental — cobre skew de relógio entre dispositivos. */
export const INCREMENTAL_SINCE_MARGIN_MS = 10 * 60_000;

/**
 * Busca o estado remoto para o sync.
 * `force` invalida apenas o cache em memória (TTL); o fetch continua incremental
 * quando existe watermark de sync anterior. Full fetch acontece só na primeira
 * sincronização ou periodicamente (FULL_FETCH_INTERVAL_MS) para autocorreção.
 */
export async function fetchRemoteCollectionsSnapshot(
  ownerUid: string,
  force = false,
): Promise<RemoteCollectionsSnapshot> {
  const fresh = peekRemoteSnapshotCache(ownerUid);
  if (!force && fresh) return fresh;

  const watermark = await getRemoteSyncWatermark(ownerUid);
  const canIncremental = watermark != null && watermark > 0 && !(await isFullFetchDue(ownerUid));

  if (canIncremental) {
    const since = Math.max(0, watermark - INCREMENTAL_SINCE_MARGIN_MS);
    const [
      deltaCad,
      deltaSess,
      deltaApp,
      deltaCadTombstones,
      deltaSessTombstones,
      deltaAppTombstones,
    ] = await Promise.all([
      fetchRemoteCollection('cadastros', ownerUid, () => getCadastrosFirestoreSince(ownerUid, since)),
      fetchRemoteCollection('sessoes', ownerUid, () => getSessoesFirestoreSince(ownerUid, since)),
      fetchRemoteCollection('aplicadores', ownerUid, () => getAplicadoresFirestoreSince(ownerUid, since)),
      fetchRemoteCollection('cadastros', ownerUid, () =>
        listCadastrosTombstonesSinceForSync(ownerUid, since),
      ),
      fetchRemoteCollection('sessoes', ownerUid, () => listSessoesTombstonesSinceForSync(ownerUid, since)),
      fetchRemoteCollection('aplicadores', ownerUid, () =>
        listAplicadoresTombstonesSinceForSync(ownerUid, since),
      ),
    ]);

    const [baseline, tombBaseline] = await Promise.all([
      buildRemoteBaselineFromLocal(ownerUid),
      buildTombstoneBaselineFromLocal(ownerUid),
    ]);

    const tombstones = {
      remoteCadTombstones: mergeById(tombBaseline.remoteCadTombstones, deltaCadTombstones),
      remoteSessTombstones: mergeById(tombBaseline.remoteSessTombstones, deltaSessTombstones),
      remoteAppTombstones: mergeById(tombBaseline.remoteAppTombstones, deltaAppTombstones),
    };

    // Registro excluído na nuvem chega só como tombstone; remove do baseline
    // ativo (local + delta) para o LWW enxergar a exclusão.
    const tombIds = {
      cad: new Set(tombstones.remoteCadTombstones.map((t) => t.id)),
      sess: new Set(tombstones.remoteSessTombstones.map((t) => t.id)),
      app: new Set(tombstones.remoteAppTombstones.map((t) => t.id)),
    };

    cached = {
      ownerUid,
      fetchedAt: Date.now(),
      fetchMode: 'incremental',
      remoteCad: mergeById(baseline.remoteCad, deltaCad).filter((r) => !tombIds.cad.has(r.id)),
      remoteSess: mergeById(baseline.remoteSess, deltaSess).filter((r) => !tombIds.sess.has(r.id)),
      remoteApp: mergeById(baseline.remoteApp, deltaApp).filter((r) => !tombIds.app.has(r.id)),
      ...tombstones,
      remotePre: [],
    };
    return cached;
  }

  const [
    remoteCad,
    remoteSess,
    remoteApp,
    remoteCadTombstones,
    remoteSessTombstones,
    remoteAppTombstones,
  ] = await Promise.all([
    fetchRemoteCollection('cadastros', ownerUid, () => getAllCadastrosFirestoreLight(ownerUid)),
    fetchRemoteCollection('sessoes', ownerUid, () => getAllSessoesFirestoreLight(ownerUid)),
    fetchRemoteCollection('aplicadores', ownerUid, () => getAllAplicadoresFirestore(ownerUid)),
    fetchRemoteCollection('cadastros', ownerUid, () => listCadastrosTombstonesForSync(ownerUid)),
    fetchRemoteCollection('sessoes', ownerUid, () => listSessoesTombstonesForSync(ownerUid)),
    fetchRemoteCollection('aplicadores', ownerUid, () => listAplicadoresTombstonesForSync(ownerUid)),
  ]);

  // markFullFetchDone só após LWW íntegro (SyncManager) — evita consumir
  // o orçamento de 24h quando o download ok mas a aplicação falha.

  cached = {
    ownerUid,
    fetchedAt: Date.now(),
    fetchMode: 'full',
    remoteCad,
    remoteSess,
    remoteApp,
    remoteCadTombstones,
    remoteSessTombstones,
    remoteAppTombstones,
    remotePre: [],
  };
  return cached;
}

/** Garante arrays de tombstone em snapshots legados ou parciais. */
export function withTombstoneDefaults(
  snapshot: Partial<RemoteCollectionsSnapshot> & Pick<RemoteCollectionsSnapshot, 'ownerUid' | 'fetchedAt' | 'remoteCad' | 'remoteSess' | 'remoteApp' | 'remotePre'>,
): RemoteCollectionsSnapshot {
  return {
    ...EMPTY_TOMBSTONES,
    fetchMode: 'full',
    ...snapshot,
    remoteCadTombstones: snapshot.remoteCadTombstones ?? [],
    remoteSessTombstones: snapshot.remoteSessTombstones ?? [],
    remoteAppTombstones: snapshot.remoteAppTombstones ?? [],
  };
}
