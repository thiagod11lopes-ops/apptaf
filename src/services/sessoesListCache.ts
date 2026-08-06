import type { SessaoAplicacaoTaf } from './resultadosAplicadosIndexedDb';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { subscribeDataChanged } from '../offline-first/sync/SyncEngine';
import { isDemoSessaoId } from '../utils/gatherSystemBackupData';

type SessoesListCacheEntry = {
  ownerUid: string | null;
  items: SessaoAplicacaoTaf[];
  dirty: boolean;
};

let cache: SessoesListCacheEntry | null = null;
let cacheGeneration = 0;
let inFlight: {
  ownerUid: string | null;
  generation: number;
  promise: Promise<SessaoAplicacaoTaf[]>;
} | null = null;
let invalidationSubscribed = false;

function ownerCacheKey(ownerUid: string | null): string | null {
  return ownerUid?.trim() ? ownerUid.trim() : getCachedDataOwnerUid();
}

function ensureSessoesListInvalidation(): void {
  if (invalidationSubscribed) return;
  invalidationSubscribed = true;
  subscribeDataChanged(() => {
    invalidateSessoesListCache();
  }, { scopes: ['sessoes'] });
}

export function invalidateSessoesListCache(): void {
  cacheGeneration += 1;
  inFlight = null;
  if (cache) {
    cache = { ...cache, dirty: true };
  }
}

export function clearSessoesListCache(): void {
  cache = null;
  cacheGeneration += 1;
  inFlight = null;
}

export function isSessoesListCacheWarm(): boolean {
  const ownerUid = ownerCacheKey(null);
  return Boolean(cache && cache.ownerUid === ownerUid && !cache.dirty);
}

export function peekSessoesListCache(opts?: {
  includeDemo?: boolean;
}): SessaoAplicacaoTaf[] | null {
  const ownerUid = ownerCacheKey(null);
  if (!cache || cache.ownerUid !== ownerUid) return null;
  const items = opts?.includeDemo
    ? cache.items
    : cache.items.filter((s) => !isDemoSessaoId(s.id));
  return items.slice();
}

function filterByDemo(items: SessaoAplicacaoTaf[], includeDemo: boolean): SessaoAplicacaoTaf[] {
  if (includeDemo) return items.slice();
  return items.filter((s) => !isDemoSessaoId(s.id));
}

export async function getSessoesListCached(
  ownerUid: string | null,
  opts: { includeDemo?: boolean } | undefined,
  fetchAllIncludingDemo: (uid: string | null) => Promise<SessaoAplicacaoTaf[]>,
): Promise<SessaoAplicacaoTaf[]> {
  ensureSessoesListInvalidation();

  const includeDemo = opts?.includeDemo === true;
  const key = ownerCacheKey(ownerUid);

  if (cache && cache.ownerUid === key && !cache.dirty) {
    return filterByDemo(cache.items, includeDemo);
  }

  if (inFlight && inFlight.ownerUid === key && inFlight.generation === cacheGeneration) {
    const items = await inFlight.promise;
    return filterByDemo(items, includeDemo);
  }

  const generation = cacheGeneration;
  const promise = fetchAllIncludingDemo(key).then((items) => {
    if (generation !== cacheGeneration) {
      return getSessoesListCached(ownerUid, { includeDemo: true }, fetchAllIncludingDemo);
    }
    cache = { ownerUid: key, items, dirty: false };
    if (inFlight?.promise === promise) inFlight = null;
    return items;
  });

  inFlight = { ownerUid: key, generation, promise };
  const items = await promise;
  return filterByDemo(items, includeDemo);
}
