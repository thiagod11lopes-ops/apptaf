import type { CadastroItemPersist } from './cadastrosIndexedDb';
import { getCachedDataOwnerUid } from './firebase/authUid';
import { subscribeDataChanged } from '../offline-first/sync/SyncEngine';
import { isDemoCadastroId } from '../utils/gatherSystemBackupData';

type CadastrosListCacheEntry = {
  ownerUid: string | null;
  /** Lista completa (inclui demo). Filtro `includeDemo` aplica na leitura. */
  items: CadastroItemPersist[];
};

let cache: CadastrosListCacheEntry | null = null;
let cacheGeneration = 0;
let inFlight: {
  ownerUid: string | null;
  generation: number;
  promise: Promise<CadastroItemPersist[]>;
} | null = null;
let invalidationSubscribed = false;

function ownerCacheKey(ownerUid: string | null): string | null {
  return ownerUid?.trim() ? ownerUid.trim() : getCachedDataOwnerUid();
}

function ensureCadastrosListInvalidation(): void {
  if (invalidationSubscribed) return;
  invalidationSubscribed = true;
  subscribeDataChanged(() => {
    invalidateCadastrosListCache();
  }, { scopes: ['cadastros'] });
}

/** Descarta o cache (gravação local / sync / notify do escopo cadastros). */
export function invalidateCadastrosListCache(): void {
  cache = null;
  cacheGeneration += 1;
  inFlight = null;
}

/** Leitura síncrona — hidrata UI sem I/O quando o cache ainda é válido. */
export function peekCadastrosListCache(opts?: {
  includeDemo?: boolean;
}): CadastroItemPersist[] | null {
  const ownerUid = ownerCacheKey(null);
  if (!cache || cache.ownerUid !== ownerUid) return null;
  const items = opts?.includeDemo
    ? cache.items
    : cache.items.filter((c) => !isDemoCadastroId(c.id));
  return items.slice();
}

function filterByDemo(
  items: CadastroItemPersist[],
  includeDemo: boolean,
): CadastroItemPersist[] {
  if (includeDemo) return items.slice();
  return items.filter((c) => !isDemoCadastroId(c.id));
}

/**
 * Resolve lista com cache em memória por owner.
 * `fetchAllIncludingDemo` deve retornar a lista completa (com demo).
 */
export async function getCadastrosListCached(
  ownerUid: string | null,
  opts: { includeDemo?: boolean } | undefined,
  fetchAllIncludingDemo: (uid: string | null) => Promise<CadastroItemPersist[]>,
): Promise<CadastroItemPersist[]> {
  ensureCadastrosListInvalidation();

  const includeDemo = opts?.includeDemo === true;
  const key = ownerCacheKey(ownerUid);

  if (cache && cache.ownerUid === key) {
    return filterByDemo(cache.items, includeDemo);
  }

  if (inFlight && inFlight.ownerUid === key && inFlight.generation === cacheGeneration) {
    const items = await inFlight.promise;
    return filterByDemo(items, includeDemo);
  }

  const generation = cacheGeneration;
  const promise = fetchAllIncludingDemo(key).then((items) => {
    if (generation !== cacheGeneration) {
      return getCadastrosListCached(ownerUid, { includeDemo: true }, fetchAllIncludingDemo);
    }
    cache = { ownerUid: key, items };
    if (inFlight?.promise === promise) inFlight = null;
    return items;
  });

  inFlight = { ownerUid: key, generation, promise };
  const items = await promise;
  return filterByDemo(items, includeDemo);
}
