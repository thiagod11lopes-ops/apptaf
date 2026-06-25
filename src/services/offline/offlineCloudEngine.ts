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
import { canAttemptCloudSync } from './networkStatus';
import {
  compactPendingOps,
  applyPendingToTombstones,
  emptyTombstones,
  type PendingOp,
  type Tombstones,
} from './pendingOps';
import {
  dedupeCadastrosByNipNewest,
} from './conflictMerge';
import { getRecordUpdatedAt, stampCadastro, stampSessao } from './recordTimestamps';
import {
  withCloudUpload,
  setCloudSyncResult,
  beginCloudSync,
  endCloudSync,
  beginRealtimeApply,
  endRealtimeApply,
} from './cloudSyncActivity';

export { subscribeCloudActivity, getCloudActivityState } from './cloudSyncActivity';
export type { CloudActivityState } from './cloudSyncActivity';

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
  return withCloudUpload(async () => {
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
  });
}

async function flushPendingOps(uid: string, entry: CloudDataCacheEntry): Promise<CloudDataCacheEntry> {
  if (entry.pendingOps.length === 0) return entry;

  const compact = compactPendingOps(entry.pendingOps);
  const upserts = compact.filter(
    (op): op is Extract<PendingOp, { kind: 'upsertCadastro' }> => op.kind === 'upsertCadastro',
  );
  const others = compact.filter((op) => op.kind !== 'upsertCadastro');

  let tombstones = entry.tombstones ?? emptyTombstones();
  const remaining: PendingOp[] = [];

  if (upserts.length > 0) {
    try {
      await withCloudUpload(() =>
        addCadastrosEmLoteFirestore(
          uid,
          upserts.map((op) => op.item),
        ),
      );
      for (const op of upserts) {
        tombstones = applyPendingToTombstones(tombstones, op);
      }
    } catch {
      remaining.push(...upserts);
    }
  }

  for (const op of others) {
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

async function pullAndMerge(
  uid: string,
  entry: CloudDataCacheEntry,
): Promise<{ entry: CloudDataCacheEntry; remoteFetched: boolean }> {
  if (!canAttemptCloudSync()) {
    return { entry, remoteFetched: false };
  }

  const localBefore = entry;
  const tombstones = entry.tombstones ?? emptyTombstones();

  try {
    let [remoteCadastros, remoteSessoes] = await Promise.all([
      getAllCadastrosFirestoreLight(uid),
      getAllSessoesFirestoreLight(uid),
    ]);

    const hasPending = (localBefore.pendingOps?.length ?? 0) > 0;
    const remoteEmpty = remoteCadastros.length === 0 && remoteSessoes.length === 0;
    const localHasData =
      localBefore.cadastros.length > 0 || localBefore.sessoes.length > 0;

    if (hasPending || (remoteEmpty && localHasData)) {
      try {
        await pushLocalChangesToCloud(uid, localBefore, remoteCadastros, remoteSessoes);
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.warn('[TAF sync] Falha ao enviar dados locais; continuando pull da nuvem.', error);
        }
      }
    }

    [remoteCadastros, remoteSessoes] = await Promise.all([
      getAllCadastrosFirestoreLight(uid),
      getAllSessoesFirestoreLight(uid),
    ]);

    return {
      entry: {
        ...buildEntry(uid, remoteCadastros, remoteSessoes, {
          pendingOps: entry.pendingOps,
          tombstones,
        }),
        syncedAt: Date.now(),
      },
      remoteFetched: true,
    };
  } catch (error) {
    if (typeof console !== 'undefined') {
      console.warn('[TAF sync] Falha ao baixar dados da nuvem:', error);
    }
    return { entry: localBefore, remoteFetched: false };
  }
}

/** Envia ao Firebase apenas itens locais mais recentes ou ausentes na nuvem. */
async function pushLocalChangesToCloud(
  uid: string,
  local: CloudDataCacheEntry,
  remoteCadastros: CadastroItemPersist[],
  remoteSessoes: SessaoAplicacaoTaf[],
): Promise<void> {
  const remoteCadMap = new Map(remoteCadastros.map((c) => [c.id, c]));
  const remoteSessMap = new Map(remoteSessoes.map((s) => [s.id, s]));

  const cadastrosToUpload: CadastroItemPersist[] = [];
  for (const item of local.cadastros) {
    const remote = remoteCadMap.get(item.id);
    const localTs = getRecordUpdatedAt(item);
    const remoteTs = remote ? getRecordUpdatedAt(remote) : 0;
    if (!remote || localTs > remoteTs) {
      cadastrosToUpload.push(item);
    }
  }

  if (cadastrosToUpload.length > 0) {
    try {
      await withCloudUpload(() => addCadastrosEmLoteFirestore(uid, cadastrosToUpload));
    } catch {
      for (const item of cadastrosToUpload) {
        try {
          await addCadastroFirestore(uid, item);
        } catch {
          // Mantido na fila pendingOps se flush falhar depois.
        }
      }
    }
  }

  for (const sessao of local.sessoes) {
    const remote = remoteSessMap.get(sessao.id);
    const localTs = getRecordUpdatedAt(sessao);
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
  let resolved!: CloudDataCacheEntry;

  const run = syncMutex.then(async () => {
    beginCloudSync();
    let remoteFetched = false;
    try {
      let entry = await loadEntry(uid);
      entry = await flushPendingOps(uid, entry);
      const pull = await pullAndMerge(uid, entry);
      entry = pull.entry;
      remoteFetched = pull.remoteFetched;
      await saveEntry(entry);
      resolved = entry;
    } finally {
      endCloudSync();
      setCloudSyncResult(remoteFetched);
    }
  });

  syncMutex = run.then(() => undefined).catch(() => undefined);
  await run;

  return resolved;
}

function enqueueSync(uid: string): void {
  syncMutex = syncMutex.then(() =>
    syncOfflineCloudData(uid).then(() => undefined).catch(() => undefined),
  );
}

export async function readOfflineCloudEntry(
  uid: string,
  options?: { autoSync?: boolean; forcePull?: boolean },
): Promise<CloudDataCacheEntry> {
  const entry = await loadEntry(uid);
  const autoSync = options?.autoSync !== false;

  if (!autoSync) {
    return entry;
  }

  // Online: sempre reconcilia com a nuvem (chefe ↔ e-mails autorizados).
  if (canAttemptCloudSync() || options?.forcePull) {
    return syncOfflineCloudData(uid);
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

/** Online: envia imediatamente ao Firebase; offline: enfileira. */
async function pushOpWhenOnline(uid: string, op: PendingOp): Promise<void> {
  if (!canAttemptCloudSync()) {
    await appendPending(uid, op);
    return;
  }

  try {
    let entry = await loadEntry(uid);
    if (entry.pendingOps.length > 0) {
      entry = await flushPendingOps(uid, entry);
      await saveEntry(entry);
    }
    await executeOpOnCloud(uid, op);
  } catch {
    await appendPending(uid, op);
  }
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
  await pushOpWhenOnline(uid, op);
}

export async function upsertCadastrosLoteOffline(
  uid: string,
  items: CadastroItemPersist[],
): Promise<void> {
  if (items.length === 0) return;
  const stamped = items.map((i) => stampCadastro(i));
  let entry = await loadEntry(uid);

  if ((entry.pendingOps?.length ?? 0) > 0) {
    entry = await flushPendingOps(uid, entry);
    await saveEntry(entry);
  }

  const map = new Map(entry.cadastros.map((c) => [c.id, c]));
  for (const item of stamped) {
    map.set(item.id, item);
  }

  const next = buildEntry(uid, [...map.values()], entry.sessoes, {
    pendingOps: entry.pendingOps,
    tombstones: entry.tombstones,
  });
  await saveEntry(next);

  let batchError: unknown;
  try {
    await withCloudUpload(() => addCadastrosEmLoteFirestore(uid, stamped));
  } catch (error) {
    batchError = error;
    const pendingOps = compactPendingOps([
      ...(entry.pendingOps ?? []),
      ...stamped.map((item) => ({
        kind: 'upsertCadastro' as const,
        at: item.updatedAt!,
        item,
      })),
    ]);
    await saveEntry({ ...next, pendingOps });
  }

  const synced = await syncOfflineCloudData(uid);
  const pending = synced.pendingOps?.length ?? 0;

  if (pending > 0) {
    const detail =
      batchError instanceof Error
        ? batchError.message
        : batchError
          ? String(batchError)
          : 'Falha no envio em lote.';
    throw new Error(
      `${pending} cadastro(s) não foram enviados à nuvem: ${detail}`,
    );
  }

  if (stamped.length > 0) {
    try {
      const remote = await getAllCadastrosFirestoreLight(uid);
      if (remote.length === 0) {
        throw new Error(
          `${stamped.length} cadastro(s) neste aparelho, mas a nuvem continua vazia. Confira login e conexão.`,
        );
      }
    } catch (verifyError) {
      if (verifyError instanceof Error && verifyError.message.includes('nuvem continua vazia')) {
        throw verifyError;
      }
      // Falha ao verificar (rede) — dados locais e sync concluídos.
    }
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
  await pushOpWhenOnline(uid, op);
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
  await pushOpWhenOnline(uid, op);
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
  await pushOpWhenOnline(uid, op);
}

export function triggerBackgroundSync(uid: string | null): void {
  if (!uid || !canAttemptCloudSync()) return;
  enqueueSync(uid);
}

/** Aplica snapshot da nuvem (tempo real) — substitui cache local, mantém fila pendente. */
export async function mergeRemoteCloudData(
  uid: string,
  remoteCadastros: CadastroItemPersist[],
  remoteSessoes: SessaoAplicacaoTaf[],
): Promise<void> {
  const run = syncMutex.then(async () => {
    beginRealtimeApply();
    try {
      const entry = await loadEntry(uid);
      const next = buildEntry(uid, remoteCadastros, remoteSessoes, {
        pendingOps: entry.pendingOps,
        tombstones: entry.tombstones ?? emptyTombstones(),
      });
      await saveEntry({ ...next, syncedAt: Date.now() });
      setCloudSyncResult(true);
    } finally {
      endRealtimeApply();
    }
  });

  syncMutex = run.then(() => undefined).catch(() => undefined);
  await run;
}

/** Envia dados do aparelho (sem login) à nuvem e recarrega só da nuvem. */
export async function importLocalDeviceDataToCloud(
  uid: string,
  localCadastros: CadastroItemPersist[],
  localSessoes: SessaoAplicacaoTaf[],
): Promise<void> {
  if (localCadastros.length === 0 && localSessoes.length === 0) return;

  const stampedCad = localCadastros.map((c) => stampCadastro(c));
  const stampedSess = localSessoes.map((s) => stampSessao(s));

  if (!canAttemptCloudSync()) {
    const run = syncMutex.then(async () => {
      const entry = await loadEntry(uid);
      const pendingOps = compactPendingOps([
        ...(entry.pendingOps ?? []),
        ...stampedCad.map((item) => ({
          kind: 'upsertCadastro' as const,
          at: item.updatedAt!,
          item,
        })),
        ...stampedSess.map((sessao) => ({
          kind: 'upsertSessao' as const,
          at: sessao.updatedAt!,
          sessao,
        })),
      ]);
      const next = buildEntry(uid, entry.cadastros, entry.sessoes, {
        pendingOps,
        tombstones: entry.tombstones,
      });
      await saveEntry(next);
    });
    syncMutex = run.then(() => undefined).catch(() => undefined);
    await run;
    return;
  }

  try {
    if (stampedCad.length > 0) {
      await withCloudUpload(() => addCadastrosEmLoteFirestore(uid, stampedCad));
    }
    for (const sessao of stampedSess) {
      await withCloudUpload(() => addSessaoFirestore(uid, sessao));
    }
  } catch {
    const run = syncMutex.then(async () => {
      const entry = await loadEntry(uid);
      const pendingOps = compactPendingOps([
        ...(entry.pendingOps ?? []),
        ...stampedCad.map((item) => ({
          kind: 'upsertCadastro' as const,
          at: item.updatedAt!,
          item,
        })),
        ...stampedSess.map((sessao) => ({
          kind: 'upsertSessao' as const,
          at: sessao.updatedAt!,
          sessao,
        })),
      ]);
      await saveEntry({ ...entry, pendingOps });
    });
    syncMutex = run.then(() => undefined).catch(() => undefined);
    await run;
  }

  await syncOfflineCloudData(uid);
}
