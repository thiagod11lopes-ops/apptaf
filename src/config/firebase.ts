import { getSupabase, isSupabaseConfigured } from './supabase';

export type CloudAuthUser = {
  uid: string;
  email: string | null;
  getIdToken: (force?: boolean) => Promise<string>;
  reload: () => Promise<void>;
};

/** Espelho síncrono da sessão Supabase — SyncManager/OfflineSync ainda consultam currentUser. */
let cachedAuthUser: CloudAuthUser | null = null;

function buildCloudAuthUser(uid: string, email: string | null): CloudAuthUser {
  return {
    uid,
    email,
    getIdToken: async (force = false) => {
      const sb = getSupabase();
      if (!sb) throw new Error('Supabase não configurado.');
      if (force) {
        const { data, error } = await sb.auth.refreshSession();
        if (error) throw new Error(error.message);
        const token = data.session?.access_token;
        if (!token) throw new Error('Sessão sem token.');
        return token;
      }
      const { data, error } = await sb.auth.getSession();
      if (error) throw new Error(error.message);
      const token = data.session?.access_token;
      if (!token) throw new Error('Sessão sem token.');
      return token;
    },
    reload: async () => {
      const sb = getSupabase();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (user) {
        cachedAuthUser = buildCloudAuthUser(user.id, user.email ?? null);
      }
    },
  };
}

/** Atualiza o espelho síncrono (chame no login/logout / onAuthStateChange). */
export function setCloudAuthUser(user: { uid: string; email: string | null } | null): void {
  cachedAuthUser = user ? buildCloudAuthUser(user.uid, user.email) : null;
}

/** Compat: nomes legados do Firebase agora apontam para Supabase. */
export function isFirebaseConfigured(): boolean {
  return isSupabaseConfigured();
}

export function getFirebaseAuth(): {
  currentUser: CloudAuthUser | null;
} | null {
  if (!isSupabaseConfigured()) return null;
  return { currentUser: cachedAuthUser };
}

export function getFirestoreDb(): null {
  return null;
}

export async function refreshCloudAuthUser(): Promise<{
  uid: string;
  email: string | null;
} | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user) {
    setCloudAuthUser(null);
    return null;
  }
  const mapped = { uid: user.id, email: user.email ?? null };
  setCloudAuthUser(mapped);
  return mapped;
}
