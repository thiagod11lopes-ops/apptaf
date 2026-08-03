/**
 * Pull direto da lista de aplicadores do dono dos dados (chefe).
 * Usado ao abrir selects (senha/rúbrica) para não depender só do sync incremental.
 */
import type { AplicadorItemPersist } from './aplicadoresIndexedDb';
import { getAllAplicadores } from './aplicadoresIndexedDb';
import { getAllAplicadoresFirestore } from './supabase/aplicadoresCloud';
import { getActiveTeamKey } from './supabase/e2eCrypto';
import {
  getOwnerDocsDecryptFailureAccum,
  resetOwnerDocsDecryptFailureAccum,
} from './supabase/ownerDocs';
import {
  getCachedDataOwnerUid,
  getCachedLoginUid,
  resolveStorageOwnerUid,
} from './firebase/authUid';
import {
  getAplicadorRaw,
  listAplicadores,
  putAplicadorRecord,
} from '../offline-first/db/localDb';
import { markRecordSynced, readUpdatedAt } from '../offline-first/sync/recordMeta';
import { remoteDocToSyncRecord } from '../offline-first/sync/tombstone';
import { notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { getConnectivityState } from '../offline-first/sync/ConnectivityMonitor';
import {
  isAuthorizedMemberSession,
  mergeAplicadorAfterRemoteDownload,
} from '../utils/aplicadorSyncPolicy';
import type { AplicadorRecord } from '../offline-first/types';

/** Resolve o UID do banco do chefe mesmo se o cache de sessão estiver inconsistente. */
export async function resolveAplicadoresOwnerUid(): Promise<string | null> {
  const { readAppMetaCache } = await import('../offline-first/db/appMeta');
  const login = getCachedLoginUid()?.trim() || null;
  const cached = getCachedDataOwnerUid()?.trim() || null;
  const persisted = readAppMetaCache('session:dataOwnerUid')?.trim() || null;
  const resolved = (await resolveStorageOwnerUid())?.trim() || null;

  for (const candidate of [cached, persisted, resolved]) {
    if (candidate && (!login || candidate !== login)) return candidate;
  }
  return cached || persisted || resolved || login;
}

let pullInFlight: Promise<AplicadorItemPersist[]> | null = null;

/**
 * Baixa todos os aplicadores ativos da nuvem para o Dexie e devolve a lista de exibição.
 * Best-effort: se offline / sem E2E / falha de rede, cai no cache local.
 */
export async function ensureAplicadoresFromCloud(opts?: {
  includeDemo?: boolean;
}): Promise<AplicadorItemPersist[]> {
  if (pullInFlight) {
    await pullInFlight.catch(() => undefined);
    return getAllAplicadores(opts);
  }

  pullInFlight = (async () => {
    const ownerUid = await resolveAplicadoresOwnerUid();
    if (!ownerUid) return getAllAplicadores(opts);

    if (getConnectivityState() !== 'ONLINE') {
      return getAllAplicadores(opts);
    }

    if (!getActiveTeamKey()) {
      try {
        const { getFirebaseAuth } = await import('../config/firebase');
        const email = getFirebaseAuth()?.currentUser?.email ?? null;
        const { ensureE2eUnlockedForSession } = await import('./supabase/teamE2eSession');
        await ensureE2eUnlockedForSession(ownerUid, email);
      } catch {
        // segue sem pull se a chave não desbloquear
      }
    }
    if (!getActiveTeamKey()) {
      return getAllAplicadores(opts);
    }

    try {
      resetOwnerDocsDecryptFailureAccum();
      const remote = await getAllAplicadoresFirestore(ownerUid);
      const loginUid = getCachedLoginUid();
      const isMember = isAuthorizedMemberSession() || Boolean(loginUid && loginUid !== ownerUid);
      const remoteIds = new Set(remote.map((r) => r.id));
      let changed = false;

      for (const item of remote) {
        if (!item.id) continue;
        const existing = await getAplicadorRaw(item.id);
        const business = mergeAplicadorAfterRemoteDownload(item, existing, isMember);
        const merged = markRecordSynced(
          remoteDocToSyncRecord({ ...business, ownerUid, id: item.id, deleted: false }, ownerUid),
          loginUid,
        );
        const same =
          existing &&
          !existing.deleted &&
          existing.ownerUid === ownerUid &&
          existing.nip === merged.nip &&
          existing.nome === merged.nome &&
          existing.senhaHash === merged.senhaHash &&
          (existing.rubricaSvg ?? '') === (merged.rubricaSvg ?? '');
        if (!same) {
          await putAplicadorRecord(merged as AplicadorRecord);
          changed = true;
        }
      }

      // Só alinha exclusões quando a lista remota veio completa (sem falha de decrypt).
      if (getOwnerDocsDecryptFailureAccum() === 0) {
        const locals = await listAplicadores(ownerUid, true);
        for (const row of locals) {
          if (row.deleted || remoteIds.has(row.id)) continue;
          const pruned = markRecordSynced(
            {
              ...row,
              ownerUid,
              deleted: true,
              updatedAt: Math.max(readUpdatedAt(row) + 1, Date.now()),
            },
            loginUid,
          );
          await putAplicadorRecord(pruned);
          changed = true;
        }
      }

      if (changed) notifyDataChanged();
    } catch (error) {
      console.warn(
        '[aplicadores] pull direto da nuvem falhou:',
        error instanceof Error ? error.message : error,
      );
    }

    return getAllAplicadores(opts);
  })();

  try {
    return await pullInFlight;
  } finally {
    pullInFlight = null;
  }
}
