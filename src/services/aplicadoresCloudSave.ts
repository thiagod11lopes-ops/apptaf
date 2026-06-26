import type { AplicadorItemPersist } from './aplicadoresIndexedDb';
import { isFirebaseConfigured } from '../config/firebase';
import { getCachedDataOwnerUid, getCachedLoginUid } from './firebase/authUid';
import { addAplicadorFirestore, deleteAplicadorFirestore } from './firebase/aplicadoresFirestore';
import { isCloudReadActive } from '../offline-first/sync/SyncManager';
import { connectivityMonitor } from '../offline-first/sync/ConnectivityMonitor';
import {
  getAplicadorRaw,
  putAplicadorRecord,
  toAplicadorRecord,
} from '../offline-first/db/localDb';
import { bumpRecordMeta } from '../offline-first/sync/ConflictResolver';
import { getDeviceId } from '../offline-first/deviceId';
import { syncQueue } from '../offline-first/sync/SyncQueue';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';

/** Cadastro de aplicador exige login, internet e modo nuvem ativo. */
export function canSaveAplicadorOnCloud(): boolean {
  return (
    isFirebaseConfigured() &&
    getCachedLoginUid() != null &&
    getCachedDataOwnerUid() != null &&
    connectivityMonitor.canSync() &&
    isCloudReadActive()
  );
}

export function aplicadorCloudRequiredMessage(): string {
  if (!isFirebaseConfigured()) {
    return 'Configure o Firebase para cadastrar aplicadores.';
  }
  if (!getCachedLoginUid()) {
    return 'Entre com Google para cadastrar aplicadores.';
  }
  if (!connectivityMonitor.canSync()) {
    return 'Sem conexão. O cadastro de aplicador só funciona online.';
  }
  if (!isCloudReadActive()) {
    return 'Aguarde a conexão com a nuvem ou resolva pendências antes de cadastrar aplicadores.';
  }
  return 'Cadastro de aplicador disponível somente com dados da nuvem.';
}

/** Grava aplicador direto no Firestore e espelha localmente como synced (sem fila pendente). */
export async function saveAplicadorDirectToCloud(item: AplicadorItemPersist): Promise<void> {
  if (!canSaveAplicadorOnCloud()) {
    throw new Error(aplicadorCloudRequiredMessage());
  }

  const ownerUid = getCachedDataOwnerUid()!;
  const loginUid = getCachedLoginUid();

  await addAplicadorFirestore(ownerUid, item);

  const existing = await getAplicadorRaw(item.id);
  const operation =
    existing && existing.ownerUid === ownerUid && !existing.deleted ? 'UPDATE' : 'CREATE';
  const record = await toAplicadorRecord(
    existing && existing.ownerUid === ownerUid ? { ...existing, ...item } : item,
    ownerUid,
    loginUid,
    operation,
  );
  if (existing && existing.ownerUid === ownerUid) {
    record.createdAt = existing.createdAt;
  }
  record.syncStatus = 'synced';
  await putAplicadorRecord(record);
  await syncQueue.clearPendingForDocument(ownerUid, 'aplicadores', item.id);
  notifyDataChanged();
}

/** Remove aplicador da nuvem e marca cópia local como synced. */
export async function deleteAplicadorDirectFromCloud(id: string): Promise<void> {
  if (!canSaveAplicadorOnCloud()) {
    throw new Error(aplicadorCloudRequiredMessage());
  }

  const ownerUid = getCachedDataOwnerUid()!;
  const loginUid = getCachedLoginUid();

  await deleteAplicadorFirestore(ownerUid, id);

  const existing = await getAplicadorRaw(id);
  if (existing && existing.ownerUid === ownerUid) {
    const record = bumpRecordMeta(existing, await getDeviceId(), loginUid, 'DELETE');
    record.deleted = true;
    record.syncStatus = 'synced';
    await putAplicadorRecord(record);
  }

  await syncQueue.clearPendingForDocument(ownerUid, 'aplicadores', id);
  notifyDataChanged();
}
