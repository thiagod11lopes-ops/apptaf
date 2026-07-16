import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isSupabaseConfigured, getSupabase } from '../config/supabase';
import { setCloudAuthUser } from '../config/firebase';
import {
  mapSupabaseUser,
  isFirebaseAuthRedirectReturn,
  isPasswordRecoveryCallback,
  clearFirebaseAuthParamsFromWindow,
  parseAuthErrorFromWindow,
  rememberRedirectAuthError,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  requestPasswordReset as requestPasswordResetCloud,
  updateAccountPassword,
  signOutCloud,
  type AppAuthUser,
} from '../services/supabase/emailAuth';
import { hydrateAppStorageFromIndexedDb } from '../offline-first/db/appMeta';
import {
  setAuthUidState,
  waitForAuthenticatedUid,
  getCachedDataOwnerUid,
  getCachedLoginUid,
  enterOfflineStorageSession,
} from '../services/firebase/authUid';
import {
  clearPersistedAuthProfile,
  persistAuthProfile,
  readPersistedAuthProfile,
} from '../services/firebase/authProfile';
import { clearMemoryCloudCache } from '../services/cloudDataCache';
import { syncEngine, notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
import { resolveLocalSessionAfterLogin } from '../offline-first/sync/syncSessionPrepare';
import { systemState } from '../offline-first/sync/SystemState';
import { resetCloudSyncStatus } from '../services/offline/cloudSyncActivity';
import { confirmCloudDisplayReady } from '../offline-first/sync/cloudDisplayGate';
import { clearPendingSyncResume } from '../offline-first/sync/syncResume';
import {
  activateE2eFromLoginPassword,
  clearE2eSession,
  restoreE2eFromSessionStorage,
} from '../services/supabase/teamE2eSession';

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  /** true enquanto resolve acesso, migração local e init da sessão após login. */
  isSessionLoading: boolean;
  /** Sessão veio do link de recuperação — pedir nova senha. */
  passwordRecoveryPending: boolean;
  /** @deprecated use supabaseEnabled — mantido para compat de UI. */
  firebaseEnabled: boolean;
  supabaseEnabled: boolean;
  /** UID dono dos dados locais (chefe quando membro autorizado). */
  dataOwnerUid: string | null;
  /** Chefe da conta — pode gerenciar e-mails autorizados e carregar planilha. */
  isBoss: boolean;
  /** Entrou com e-mail autorizado pelo chefe — usa banco do chefe. */
  isAuthorizedMember: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  logout: () => Promise<void>;
  /** Atualiza flags chefe/membro a partir do ownerUid persistido localmente. */
  syncLocalSessionFlags: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function restoreE2eForOwner(ownerUid: string): Promise<void> {
  try {
    await restoreE2eFromSessionStorage(ownerUid);
  } catch (error) {
    console.warn('[e2e] restauração da sessão falhou:', error);
  }
}

async function activateE2eWithPassword(
  ownerUid: string,
  password: string,
  options?: { strict?: boolean },
): Promise<void> {
  if (!ownerUid.trim() || !password) return;
  try {
    await activateE2eFromLoginPassword(ownerUid, password);
  } catch (error) {
    console.warn('[e2e] ativação com senha de login falhou:', error);
    if (options?.strict) throw error;
  }
}

function hydrateInitialUser(): AppAuthUser | null {
  return readPersistedAuthProfile();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(hydrateInitialUser);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const [isAuthorizedMember, setIsAuthorizedMember] = useState(false);
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(() => getCachedDataOwnerUid());
  const supabaseEnabled = isSupabaseConfigured();
  const firebaseEnabled = supabaseEnabled;
  const authInitializedRef = useRef(false);
  const passwordRecoveryPendingRef = useRef(false);
  /** UID já finalizado nesta sessão (evita re-finalizar em loop com eventos repetidos do Supabase). */
  const finalizedUidRef = useRef<string | null>(null);
  const finalizingRef = useRef(false);

  const setRecoveryPending = useCallback((value: boolean) => {
    passwordRecoveryPendingRef.current = value;
    setPasswordRecoveryPending(value);
  }, []);

  const applySignedInAppUserFallback = useCallback(async (mapped: AppAuthUser) => {
    await hydrateAppStorageFromIndexedDb();
    confirmCloudDisplayReady();
    const access = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email).catch(() => null);
    const ownerUid = access?.dataOwnerUid ?? getCachedDataOwnerUid() ?? mapped.uid;
    await restoreE2eForOwner(ownerUid);
    const isMember = access?.isAuthorizedMember ?? ownerUid !== mapped.uid;
    setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
    setUser(mapped);
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(isMember);
    setAuthUidState(mapped.uid, ownerUid, true);
    persistAuthProfile(mapped);
    clearPendingSyncResume();
    setAuthReady(true);
    notifyDataChanged();
    if (supabaseEnabled) {
      await syncManager.bindSession(ownerUid);
      syncManager.setAuthAvailable(true);
      await syncManager.refreshCloudDiff();
    }
  }, [supabaseEnabled]);

  const finalizeAuthenticatedSession = useCallback(
    async (mapped: AppAuthUser, { force = false }: { force?: boolean } = {}) => {
      // Evita loop de finalização: eventos INITIAL_SESSION/SIGNED_IN repetidos para o mesmo usuário.
      if (finalizingRef.current) return;
      if (!force && finalizedUidRef.current === mapped.uid) {
        setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
        syncManager.setAuthAvailable(true);
        return;
      }
      finalizingRef.current = true;
      finalizedUidRef.current = mapped.uid;
      setIsSessionLoading(true);
      try {
        await hydrateAppStorageFromIndexedDb();
        confirmCloudDisplayReady();
        const session = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email);
        await restoreE2eForOwner(session.dataOwnerUid);
        setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
        setUser(mapped);
        setDataOwnerUid(session.dataOwnerUid);
        setIsAuthorizedMember(session.isAuthorizedMember);
        setAuthUidState(mapped.uid, session.dataOwnerUid, true);
        persistAuthProfile(mapped);
        clearPendingSyncResume();
        setAuthReady(true);
        notifyDataChanged();

        if (supabaseEnabled) {
          await syncManager.bindSession(session.dataOwnerUid);
          syncManager.setAuthAvailable(true);
          await syncManager.refreshCloudDiff();
        }
      } catch (error) {
        console.warn('[auth] finalizeAuthenticatedSession falhou:', error);
        await applySignedInAppUserFallback(mapped);
      } finally {
        finalizingRef.current = false;
        setIsSessionLoading(false);
      }
    },
    [applySignedInAppUserFallback, supabaseEnabled],
  );

  const finalizeAuthenticatedSessionRef = useRef(finalizeAuthenticatedSession);
  finalizeAuthenticatedSessionRef.current = finalizeAuthenticatedSession;

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      void (async () => {
        await hydrateAppStorageFromIndexedDb();
        const owner = getCachedDataOwnerUid();
        setDataOwnerUid(owner);
        setAuthUidState(null, owner, true);
        setAuthReady(true);
      })();
      return;
    }

    let cancelled = false;

    const applySignedIn = (uid: string, email: string | null, meta?: Record<string, unknown>) => {
      void finalizeAuthenticatedSessionRef.current(
        mapSupabaseUser({ id: uid, email, user_metadata: meta }),
      );
    };

    const applyLocalOfflineSession = (): void => {
      const owner = getCachedDataOwnerUid();
      const profile = readPersistedAuthProfile();
      const loginUid = profile?.uid ?? getCachedLoginUid();
      setUser(profile);
      setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
      setDataOwnerUid(owner);
      setAuthUidState(loginUid, owner, true);
      void systemState.setOfflineMode();
      setAuthReady(true);
    };

    const confirmSignedOut = (): void => {
      void (async () => {
        if (cancelled) return;
        const { data } = await sb.auth.getSession();
        if (data.session?.user) return;
        if (isFirebaseAuthRedirectReturn()) return;
        finalizedUidRef.current = null;
        finalizingRef.current = false;
        setIsSessionLoading(false);
        setRecoveryPending(false);

        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const owner = getCachedDataOwnerUid();
        const profile = readPersistedAuthProfile();
        if (offline && (owner || profile)) {
          setUser(profile);
          const loginUid = profile?.uid ?? getCachedLoginUid();
          setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
          setDataOwnerUid(owner);
          setAuthUidState(loginUid, owner, true);
          void systemState.setOfflineMode();
          setAuthReady(true);
          return;
        }

        applyLocalOfflineSession();
      })();
    };

    void (async () => {
      await hydrateAppStorageFromIndexedDb();
      const owner = getCachedDataOwnerUid();
      setDataOwnerUid(owner);

      const windowError = parseAuthErrorFromWindow();
      if (windowError) {
        rememberRedirectAuthError(windowError);
        clearFirebaseAuthParamsFromWindow();
      }

      const { data } = await sb.auth.getSession();
      authInitializedRef.current = true;
      if (cancelled) return;

      if (data.session?.user) {
        if (isPasswordRecoveryCallback()) {
          setRecoveryPending(true);
          setCloudAuthUser({
            uid: data.session.user.id,
            email: data.session.user.email ?? null,
          });
          setUser(mapSupabaseUser(data.session.user));
          setAuthReady(true);
        } else {
          applySignedIn(
            data.session.user.id,
            data.session.user.email ?? null,
            data.session.user.user_metadata as Record<string, unknown>,
          );
        }
        clearFirebaseAuthParamsFromWindow();
      } else if (isFirebaseAuthRedirectReturn()) {
        setAuthReady(true);
      } else if (owner) {
        const profile = readPersistedAuthProfile();
        const loginUid = profile?.uid ?? getCachedLoginUid();
        setUser(profile);
        setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
        setAuthUidState(loginUid, owner, true);
        setAuthReady(true);
        await syncManager.bindSession(owner);
        syncManager.setAuthAvailable(Boolean(data.session?.user));
      } else {
        applyLocalOfflineSession();
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryPending(true);
        if (session?.user) {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
          setUser(mapSupabaseUser(session.user));
          setAuthReady(true);
        }
        clearFirebaseAuthParamsFromWindow();
        return;
      }
      if (session?.user) {
        if (passwordRecoveryPendingRef.current && event !== 'USER_UPDATED') {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
          clearFirebaseAuthParamsFromWindow();
          return;
        }
        if (event !== 'TOKEN_REFRESHED') {
          applySignedIn(
            session.user.id,
            session.user.email ?? null,
            session.user.user_metadata as Record<string, unknown>,
          );
        } else {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
        }
        clearFirebaseAuthParamsFromWindow();
        return;
      }
      if (!authInitializedRef.current || isFirebaseAuthRedirectReturn()) return;
      if (event === 'SIGNED_OUT') confirmSignedOut();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!supabaseEnabled) {
        throw new Error(
          'Configure o Supabase no arquivo .env (veja .env.example) antes de entrar.',
        );
      }
      const signedIn = await signInWithEmailPassword(email, password);
      setRecoveryPending(false);
      const session = await resolveLocalSessionAfterLogin(signedIn.uid, signedIn.email);
      await activateE2eWithPassword(session.dataOwnerUid, password, { strict: true });
      await finalizeAuthenticatedSession(signedIn);
      await waitForAuthenticatedUid(20_000);
    },
    [finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!supabaseEnabled) {
        throw new Error(
          'Configure o Supabase no arquivo .env (veja .env.example) antes de criar conta.',
        );
      }
      const result = await signUpWithEmailPassword(email, password);
      if (result.user && !result.needsEmailConfirmation) {
        setRecoveryPending(false);
        const session = await resolveLocalSessionAfterLogin(result.user.uid, result.user.email);
        await activateE2eWithPassword(session.dataOwnerUid, password, { strict: true });
        await finalizeAuthenticatedSession(result.user);
        await waitForAuthenticatedUid(20_000);
      }
      return { needsEmailConfirmation: result.needsEmailConfirmation };
    },
    [finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!supabaseEnabled) {
        throw new Error('Configure o Supabase no arquivo .env antes de recuperar a senha.');
      }
      await requestPasswordResetCloud(email);
    },
    [supabaseEnabled],
  );

  const updatePassword = useCallback(
    async (newPassword: string) => {
      if (!supabaseEnabled) {
        throw new Error('Configure o Supabase no arquivo .env.');
      }
      await updateAccountPassword(newPassword);
      setRecoveryPending(false);
      const sb = getSupabase();
      const { data } = await sb!.auth.getSession();
      if (data.session?.user) {
        await finalizeAuthenticatedSession(mapSupabaseUser(data.session.user), { force: true });
      }
    },
    [finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled],
  );

  const clearPasswordRecovery = useCallback(() => {
    setRecoveryPending(false);
  }, [setRecoveryPending]);

  const syncLocalSessionFlags = useCallback(() => {
    const loginUid = getCachedLoginUid();
    const ownerUid = getCachedDataOwnerUid();
    if (!loginUid || !ownerUid) return;
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(ownerUid !== loginUid);
  }, []);

  const logout = useCallback(async () => {
    const ownerBeforeLogout = getCachedDataOwnerUid();
    finalizedUidRef.current = null;
    finalizingRef.current = false;
    clearE2eSession();
    await signOutCloud();
    setCloudAuthUser(null);
    setUser(null);
    setRecoveryPending(false);
    setIsAuthorizedMember(false);
    clearPersistedAuthProfile();
    clearMemoryCloudCache();
    resetCloudSyncStatus();
    confirmCloudDisplayReady();
    syncEngine.shutdown();
    await syncManager.shutdown();
    await systemState.setOfflineMode();
    await enterOfflineStorageSession();
    setDataOwnerUid(ownerBeforeLogout ?? getCachedDataOwnerUid());
    notifyDataChanged();
  }, []);

  const isBoss = user != null && !isAuthorizedMember;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      isSessionLoading,
      passwordRecoveryPending,
      firebaseEnabled,
      supabaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      logout,
      syncLocalSessionFlags,
    }),
    [
      user,
      authReady,
      isSessionLoading,
      passwordRecoveryPending,
      firebaseEnabled,
      supabaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      logout,
      syncLocalSessionFlags,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}

export type { AppAuthUser };
