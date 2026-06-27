import type { AppAuthUser } from './googleAuth';
import {
  readAppMetaCache,
  removeAppMetaSync,
  writeAppMetaSync,
} from '../../offline-first/db/appMeta';

const AUTH_PROFILE_META_KEY = 'auth:profile';

let cachedProfile: AppAuthUser | null = null;

function parseAuthProfile(raw: string): AppAuthUser | null {
  try {
    const parsed = JSON.parse(raw) as AppAuthUser;
    if (!parsed?.uid?.trim()) return null;
    return {
      uid: parsed.uid,
      email: parsed.email ?? null,
      displayName: parsed.displayName ?? null,
      photoURL: parsed.photoURL ?? null,
    };
  } catch {
    return null;
  }
}

export async function hydrateAuthProfileFromIndexedDb(): Promise<AppAuthUser | null> {
  if (cachedProfile) return cachedProfile;
  const raw = readAppMetaCache(AUTH_PROFILE_META_KEY);
  cachedProfile = raw ? parseAuthProfile(raw) : null;
  return cachedProfile;
}

export function readPersistedAuthProfile(): AppAuthUser | null {
  if (cachedProfile) return cachedProfile;
  const raw = readAppMetaCache(AUTH_PROFILE_META_KEY);
  cachedProfile = raw ? parseAuthProfile(raw) : null;
  return cachedProfile;
}

export function persistAuthProfile(user: AppAuthUser): void {
  cachedProfile = user;
  writeAppMetaSync(AUTH_PROFILE_META_KEY, JSON.stringify(user));
}

export function clearPersistedAuthProfile(): void {
  cachedProfile = null;
  removeAppMetaSync(AUTH_PROFILE_META_KEY);
}

/** Reseta cache — apenas testes. */
export function resetAuthProfileCacheForTests(): void {
  cachedProfile = null;
}
