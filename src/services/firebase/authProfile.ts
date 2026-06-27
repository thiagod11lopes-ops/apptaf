import type { AppAuthUser } from './googleAuth';

const AUTH_PROFILE_KEY = 'taf:authProfile';

export function readPersistedAuthProfile(): AppAuthUser | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_PROFILE_KEY);
    if (!raw) return null;
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

export function persistAuthProfile(user: AppAuthUser): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(user));
  } catch {
    // quota / modo privado
  }
}

export function clearPersistedAuthProfile(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_PROFILE_KEY);
  } catch {
    // silencioso
  }
}
