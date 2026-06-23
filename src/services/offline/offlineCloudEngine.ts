import type { CadastroItemPersist } from '../cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../resultadosAplicadosIndexedDb';
import { calcularResumoInicioTafFromHistorico } from '../../utils/resultadoGeralHistorico';
import {
  readCloudDataCache,
  writeCloudDataCache,
  getMemoryCloudCache,
  setMemoryCloudCache,
  type CloudDataCacheEntry,
} from '../cloudDataCache';
import {
  addCadastroFirestore,
  addCadastrosEmLoteFirestore,
  deleteCadastroFirestore,
} from '../firebase/cadastrosFirestore';
import {
  addSessaoFirestore,
  deleteSessaoFirestore,
  updateSessaoFirestore,
} from '../firebase/sessoesFirestore';
import { getAllCadastrosFirestoreLight } from '../firebase/cadastrosFirestore';
import { getAllSessoesFirestoreLight } from '../firebase/sessoesFirestore';
import { isOnline } from './networkStatus';
import {
  compactPendingOps,
  applyPendingToTombstones,
  emptyTombstones,
  type PendingOp,
  type Tombstones,
} from './pendingOps';
import {
  dedupeCadastrosByNipNewest,
  mergeCadastros,
  mergeSessoes,
} from './conflictMerge';
import { getRecordUpdatedAt, stampCadastro, stampSessao } from './recordTimestamps';

let syncMutex: Promise<void> = Promise.resolve();
let syncListeners = new Set<(entry: CloudDataCacheEntry) => void>();

export function subscribeOfflineData(listener: (entry: CloudDataCacheEntry) => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifyListeners(entry: CloudDataCacheEntry): void {
  syncListeners.forEach((fn) => fn(entry));
}

function buildEntry(
  uid: string,
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
  extra?: Partial<Pick<CloudDataCacheEntry, 'pendingOps' | 'tombstones'>>,
): CloudDataCacheEntry {
  const deduped = dedupeCadastrosByNipNewest(cadastros);
  return {
    uid,
    cadastros: deduped,
    sessoes,
    resumo: calcularResumoInicioTafFromHistorico(sessoes, deduped),
    syncedAt: Date.now(),
    pendingOps: extra?.pendingOps ?? [],
    tombstones: extra?.tombstones ?? emptyTombstones(),
  };
}

async function loadEntry(uid: string): Promise<CloudDataCacheEntry> {
  const mem = getMemoryCloudCache(uid);
  if (mem) return mem;
  const disk = await readCloudDataCache(uid);
  if (disk) {
    setMemoryCloudCache(disk);
    return disk;
  }
  return buildEntry(uid, [], []);
}

async function saveEntry(entry: CloudDataCacheEntry): Promise<void> {
  setMemoryCloudCache(entry);
  await writeCloudDataCache(entry);
  notifyListeners(entry);
}

async function executeOpOnCloud(uid: string, op: PendingOp): Promise<void> {
  if (op.kind === 'upsertCadastro') {
    await addCadastroFirestore(uid, op.item);
    return;
  }
  if (op.kind === 'deleteCadastro') {
    await deleteCadastroFirestore(uid, op.id);
    return;
  }
  if (op.kind === 'upsertSessao') {
    await updateSessaoFirestore(uid, op.sessao);
    return;
  }
  if (op.kind === 'deleteSessao') {
    await deleteSessaoFirestore(uid, op.id);
  }
}

async function flushPendingOps(uid: string, entry: CloudDataCacheEntry): Promise<CloudDataCacheEntry> {
  if (!isOnline() || entry.pendingOps.length === 0) return entry;

  let tombstones = entry.tombstones ?? emptyTombstones();
  const remaining: PendingOp[] = [];

  for (const op of entry.pendingOps) {
    try {
      await executeOpOnCloud(uid, op);
      tombstones = applyPendingToTombstones(tombstones, op);
    } catch {
      remaining.push(op);
    }
  }

  return {
    ...entry,
    pendingOps: compactPendingOps(remaining),
    tombstones,
  };
}

async function pullAndMerge(uid: string, entry: CloudDataCacheEntry): Promise<CloudDataCacheEntry> {
  if (!isOnline()) return entry;

  try {
    const [remoteCadastros, remoteSessoes] = await Promise.all([
      getAllCadastrosFirestoreLight(uid),
      getAllSessoesFirestoreLight(uid),
    ]);

    const tombstones = entry.tombstones ?? emptyTombstones();
    const mergedCadastros = dedupeCadastrosByNipNewest(
      mergeCadastros(entry.cadastros, remoteCadastros, tombstones.cadastros),
    );
    const mergedSessoes = mergeSessoes(entry.sessoes, remoteSessoes, tombstones.sessoes);

    const merged = buildEntry(uid, mergedCadastros, mergedSessoes, {
      pendingOps: entry.pendingOps,
      tombstones,
    });

    await pushLocalWinsToCloud(uid, entry, merged, remoteCadastros, remoteSessoes);

    return { ...merged, syncedAt: Date.now() };
  } catch {
    return entry;
  }
}

async function pushLocalWinsToCloud(
  uid: string,
  localBefore: CloudDataCacheEntry,
  merged: CloudDataCacheEntry,
  remoteCadastros: CadastroItemPersist[],
  remoteSessoes: SessaoAplicacaoTaf[],
): Promise<void> {
  const remoteCadMap = new Map(remoteCadastros.map((c) => [c.id, c]));
  const remoteSessMap = new Map(remoteSessoes.map((s) => [s.id, s]));

  for (const item of merged.cadastros) {
    const remote = remoteCadMap.get(item.id);
    const local = localBefore.cadastros.find((c) => c.id === item.id);
    const localTs = local ? getRecordUpdatedAt(local) : 0;
    const remoteTs = remote ? getRecordUpdatedAt(remote) : 0;
    if (!remote || localTs > remoteTs) {
      try {
        await addCadastroFirestore(uid, item);
      } catch {
        // permanece na fila via pendingOps se necessário
      }
    }
  }

  for (const sessao of merged.sessoes) {
    const remote = remoteSessMap.get(sessao.id);
    const local = localBefore.sessoes.find((s) => s.id === sessao.id);
    const localTs = local ? getRecordUpdatedAt(local) : 0;
    const remoteTs = remote ? getRecordUpdatedAt(remote) : 0;
    if (!remote || localTs > remoteTs) {
      try {
        if (remote) await updateSessaoFirestore(uid, sessao);
        else await addSessaoFirestore(uid, sessao);
      } catch {
        // silencioso
      }
    }
  }
}

export async function syncOfflineCloudData(uid: string): Promise<CloudDataCacheEntry> {
  let entry = await loadEntry(uid);
  entry = await flushPendingOps(uid, entry);
  entry = await pullAndMerge(uid, entry);
  await saveEntry(entry);
  return entry;
}

function enqueueSync(uid: string): void {
  syncMutex = syncMutex.then(() =>
    syncOfflineCloudData(uid).then(() => undefined).catch(() => undefined),
  );
}

export async function readOfflineCloudEntry(
  uid: string,
  options?: { autoSync?: boolean },
): Promise<CloudDataCacheEntry> {
  const entry = await loadEntry(uid);
  const pendingCount = entry.pendingOps?.length ?? 0;
  const mayAutoSync =
    options?.autoSync !== false && isOnline() && pendingCount === 0;
  if (mayAutoSync) {
    enqueueSync(uid);
  }
  return entry;
}

export async function hasPendingLocalChanges(uid: string): Promise<boolean> {
  const entry = await loadEntry(uid);
  return (entry.pendingOps?.length ?? 0) > 0;
}

/** Envia alterações locais (fila pendente) para a nuvem e reconcilia com o servidor. */
export async function pushDeviceUpdatesToCloud(uid: string): Promise<CloudDataCacheEntry> {
  return syncOfflineCloudData(uid);
}

async function appendPending(uid: string, op: PendingOp): Promise<CloudDataCacheEntry> {
  const entry = await loadEntry(uid);
  const pendingOps = compactPendingOps([...(entry.pendingOps ?? []), op]);
  let tombstones = entry.tombstones ?? emptyTombstones();
  tombstones = applyPendingToTombstones(tombstones, op);

  const next = { ...entry, pendingOps, tombstones };
  await saveEntry(next);
  return next;
}

export async function upsertCadastroOffline(uid: string, item: CadastroItemPersist): Promise<void> {
  const stamped = stampCadastro(item);
  const entry = await loadEntry(uid);
  const lista = [...entry.cadastros];
  const idx = lista.findIndex((c) => c.id === stamped.id);
  const merged = idx >= 0 ? { ...lista[idx], ...stamped } : stamped;
  if (idx >= 0) lista[idx] = merged;
  else lista.push(merged);

  const next = buildEntry(uid, lista, entry.sessoes, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  const op: PendingOp = { kind: 'upsertCadastro', at: stamped.updatedAt!, item: stamped };

  const hasPending = (entry.pendingOps?.length ?? 0) > 0;
  if (isOnline() && !hasPending) {
    try {
      await executeOpOnCloud(uid, op);
      await syncOfflineCloudData(uid);
      return;
    } catch {
      // enfileira
    }
  }

  await appendPending(uid, op);
}

export async function upsertCadastrosLoteOffline(
  uid: string,
  items: CadastroItemPersist[],
): Promise<void> {
  if (items.length === 0) return;
  const stamped = items.map((i) => stampCadastro(i));
  const entry = await loadEntry(uid);
  const map = new Map(entry.cadastros.map((c) => [c.id, c]));
  for (const item of stamped) {
    map.set(item.id, item);
  }

  const next = buildEntry(uid, [...map.values()], entry.sessoes, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  if (isOnline() && (entry.pendingOps?.length ?? 0) === 0) {
    try {
      await addCadastrosEmLoteFirestore(uid, stamped);
      await syncOfflineCloudData(uid);
      return;
    } catch {
      // enfileira individualmente
    }
  }

  for (const item of stamped) {
    await appendPending(uid, { kind: 'upsertCadastro', at: item.updatedAt!, item });
  }
}

export async function deleteCadastroOffline(uid: string, id: string): Promise<void> {
  const at = Date.now();
  const entry = await loadEntry(uid);
  const lista = entry.cadastros.filter((c) => c.id !== id);
  const next = buildEntry(uid, lista, entry.sessoes, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  const op: PendingOp = { kind: 'deleteCadastro', at, id };

  const hasPending = (entry.pendingOps?.length ?? 0) > 0;
  if (isOnline() && !hasPending) {
    try {
      await executeOpOnCloud(uid, op);
      await syncOfflineCloudData(uid);
      return;
    } catch {
      // enfileira
    }
  }

  await appendPending(uid, op);
}

export async function upsertSessaoOffline(uid: string, sessao: SessaoAplicacaoTaf): Promise<void> {
  const stamped = stampSessao(sessao);
  const entry = await loadEntry(uid);
  const lista = [...entry.sessoes];
  const idx = lista.findIndex((s) => s.id === stamped.id);
  if (idx >= 0) lista[idx] = stamped;
  else lista.unshift(stamped);

  const next = buildEntry(uid, entry.cadastros, lista, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  const op: PendingOp = { kind: 'upsertSessao', at: stamped.updatedAt!, sessao: stamped };

  const hasPending = (entry.pendingOps?.length ?? 0) > 0;
  if (isOnline() && !hasPending) {
    try {
      await executeOpOnCloud(uid, op);
      await syncOfflineCloudData(uid);
      return;
    } catch {
      // enfileira
    }
  }

  await appendPending(uid, op);
}

export async function deleteSessaoOffline(uid: string, id: string): Promise<void> {
  const at = Date.now();
  const entry = await loadEntry(uid);
  const lista = entry.sessoes.filter((s) => s.id !== id);
  const next = buildEntry(uid, entry.cadastros, lista, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  const op: PendingOp = { kind: 'deleteSessao', at, id };

  const hasPending = (entry.pendingOps?.length ?? 0) > 0;
  if (isOnline() && !hasPending) {
    try {
      await executeOpOnCloud(uid, op);
      await syncOfflineCloudData(uid);
      return;
    } catch {
      // enfileira
    }
  }

  await appendPending(uid, op);
}

export function triggerBackgroundSync(uid: string | null): void {
  if (!uid || !isOnline()) return;
  enqueueSync(uid);
}
