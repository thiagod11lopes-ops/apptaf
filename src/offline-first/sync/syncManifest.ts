/**
 * SyncManifest / SyncPlan — metadata-only (Prompt 7.0).
 * Não contém conteúdo de negócio descriptografado.
 */

import type { CollectionName } from '../types';
import { decideLastWriteWins, type LwwAction } from './lastWriteWins';
import { readSyncVersion } from './recordMeta';

export type SyncManifestSide = {
  exists: boolean;
  updatedAt: number;
  syncVersion?: number;
  deleted: boolean;
  baseVersion?: number;
  deviceId?: string;
};

export type SyncManifestItem = {
  id: string;
  collection: CollectionName;
  local: SyncManifestSide;
  remote: SyncManifestSide;
};

export type SyncPlanAction = 'upload' | 'download' | 'ignore' | 'conflict';

export type SyncPlanItem = {
  id: string;
  collection: CollectionName;
  action: SyncPlanAction;
  /** Decisão LWW quando conflict (só classificação). */
  resolutionAction?: 'upload' | 'download';
  reason: string;
};

export type SyncPlan = {
  upload: SyncPlanItem[];
  download: SyncPlanItem[];
  conflict: SyncPlanItem[];
  ignore: SyncPlanItem[];
};

export function emptyManifestSide(): SyncManifestSide {
  return { exists: false, updatedAt: 0, deleted: false };
}

export function buildSyncManifest(
  collection: CollectionName,
  localRows: Array<{
    id: string;
    updatedAt?: number;
    syncVersion?: number;
    version?: number;
    deleted?: boolean;
    baseVersion?: number;
    deviceId?: string;
  }>,
  remoteRows: Array<{
    id: string;
    updatedAt?: number;
    syncVersion?: number;
    version?: number;
    deleted?: boolean;
    baseVersion?: number;
    deviceId?: string;
  }>,
): SyncManifestItem[] {
  const localMap = new Map(localRows.map((r) => [r.id, r]));
  const remoteMap = new Map(remoteRows.map((r) => [r.id, r]));
  const ids = new Set([...localMap.keys(), ...remoteMap.keys()]);
  const items: SyncManifestItem[] = [];

  for (const id of ids) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    items.push({
      id,
      collection,
      local: local
        ? {
            exists: true,
            updatedAt: local.updatedAt ?? 0,
            syncVersion: local.syncVersion ?? local.version,
            deleted: local.deleted === true,
            baseVersion: local.baseVersion,
            deviceId: local.deviceId,
          }
        : emptyManifestSide(),
      remote: remote
        ? {
            exists: true,
            updatedAt: remote.updatedAt ?? 0,
            syncVersion: remote.syncVersion ?? remote.version,
            deleted: remote.deleted === true,
            baseVersion: remote.baseVersion,
            deviceId: remote.deviceId,
          }
        : emptyManifestSide(),
    });
  }

  return items;
}

function toLwwPartial(side: SyncManifestSide) {
  if (!side.exists) return null;
  return {
    updatedAt: side.updatedAt,
    syncVersion: side.syncVersion,
    version: side.syncVersion,
    deleted: side.deleted,
    baseVersion: side.baseVersion,
    deviceId: side.deviceId,
  };
}

/**
 * Plano a partir do manifest — delega a decideLastWriteWins (sem alterar algoritmo).
 * `conflict` = ambos existem e baseVersion indica divergência causal; LWW ainda decide.
 */
export function buildSyncPlanFromManifest(manifest: SyncManifestItem[]): SyncPlan {
  const plan: SyncPlan = { upload: [], download: [], conflict: [], ignore: [] };

  for (const item of manifest) {
    const decision = decideLastWriteWins(toLwwPartial(item.local), toLwwPartial(item.remote));
    const action = mapLwwToPlanAction(decision.action);

    const hasCausalConflict =
      item.local.exists &&
      item.remote.exists &&
      typeof item.local.baseVersion === 'number' &&
      typeof item.remote.syncVersion === 'number' &&
      item.remote.syncVersion !== item.local.baseVersion &&
      action !== 'ignore';

    if (hasCausalConflict && (action === 'upload' || action === 'download')) {
      plan.conflict.push({
        id: item.id,
        collection: item.collection,
        action: 'conflict',
        resolutionAction: action,
        reason: `causal_baseVersion_${decision.reason}`,
      });
      // LWW ainda executa a resolução:
      const resolved: SyncPlanItem = {
        id: item.id,
        collection: item.collection,
        action,
        reason: decision.reason,
      };
      if (action === 'upload') plan.upload.push(resolved);
      else plan.download.push(resolved);
      continue;
    }

    if (action === 'upload') {
      plan.upload.push({ id: item.id, collection: item.collection, action, reason: decision.reason });
    } else if (action === 'download') {
      plan.download.push({ id: item.id, collection: item.collection, action, reason: decision.reason });
    } else {
      plan.ignore.push({ id: item.id, collection: item.collection, action: 'ignore', reason: decision.reason });
    }
  }

  return plan;
}

function mapLwwToPlanAction(action: LwwAction): SyncPlanAction {
  if (action === 'upload') return 'upload';
  if (action === 'download') return 'download';
  return 'ignore';
}

/** Helper de teste/estatística — syncVersion local vs remota. */
export function manifestSyncVersionsEqual(item: SyncManifestItem): boolean {
  if (!item.local.exists || !item.remote.exists) return false;
  return (
    readSyncVersion(toLwwPartial(item.local)) === readSyncVersion(toLwwPartial(item.remote)) &&
    item.local.updatedAt === item.remote.updatedAt &&
    item.local.deleted === item.remote.deleted
  );
}
