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
import { Platform } from 'react-native';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { isFirebaseConfigured, getFirebaseAuth } from '../config/firebase';
import {
  mapFirebaseUser,
  signInWithGoogleCredential,
  signInWithGoogleWeb,
  startFirebaseRedirectSignIn,
  isFirebaseAuthRedirectReturn,
  clearFirebaseAuthParamsFromWindow,
  signOutFirebase,
  type AppAuthUser,
} from '../services/firebase/googleAuth';
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

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  /** true enquanto resolve acesso, migração local e init da sessão após Google. */
  isSessionLoading: boolean;
  firebaseEnabled: boolean;
  /** UID dono dos dados locais (chefe quando membro autorizado). */
  dataOwnerUid: string | null;
  /** Chefe da conta — pode gerenciar e-mails autorizados e carregar planilha. */
  isBoss: boolean;
  /** Entrou com e-mail autorizado pelo chefe — usa banco do chefe. */
  isAuthorizedMember: boolean;
  signInWithGoogle: (idToken?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Atualiza flags chefe/membro a partir do ownerUid persistido localmente. */
  syncLocalSessionFlags: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function hydrateInitialUser(): AppAuthUser | null {
  return readPersistedAuthProfile();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(hydrateInitialUser);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isAuthorizedMember, setIsAuthorizedMember] = useState(false);
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(() => getCachedDataOwnerUid());
  const firebaseEnabled = isFirebaseConfigured();
  const authInitializedRef = useRef(false);

  const applySignedInAppUserFallback = useCallback(async (mapped: AppAuthUser) => {
    await hydrateAppStorageFromIndexedDb();
    const access = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email).catch(() => null);
    const ownerUid = access?.dataOwnerUid ?? getCachedDataOwnerUid() ?? mapped.uid;
    const isMember = access?.isAuthorizedMember ?? ownerUid !== mapped.uid;
    setUser(mapped);
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(isMember);
    setAuthUidState(mapped.uid, ownerUid, true);
    persistAuthProfile(mapped);
    clearPendingSyncResume();
    setAuthReady(true);
    notifyDataChanged();
    if (firebaseEnabled && getFirebaseAuth()?.currentUser) {
      await syncManager.bindSession(ownerUid);
      syncManager.setAuthAvailable(true);
      await syncManager.refreshCloudDiff();
    }
  }, [firebaseEnabled]);

  const finalizeAuthenticatedSession = useCallback(
    async (mapped: AppAuthUser) => {
      setIsSessionLoading(true);
      try {
        await hydrateAppStorageFromIndexedDb();
        const session = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email);
        setUser(mapped);
        setDataOwnerUid(session.dataOwnerUid);
        setIsAuthorizedMember(session.isAuthorizedMember);
        persistAuthProfile(mapped);
        clearPendingSyncResume();
        setAuthReady(true);
        notifyDataChanged();

        if (firebaseEnabled && getFirebaseAuth()?.currentUser) {
          await syncManager.bindSession(session.dataOwnerUid);
          syncManager.setAuthAvailable(true);
          await syncManager.refreshCloudDiff();
        }
      } catch (error) {
        console.warn('[auth] finalizeAuthenticatedSession falhou:', error);
        await applySignedInAppUserFallback(mapped);
      } finally {
        setIsSessionLoading(false);
      }
    },
    [applySignedInAppUserFallback, firebaseEnabled],
  );

  const finalizeAuthenticatedSessionRef = useRef(finalizeAuthenticatedSession);
  finalizeAuthenticatedSessionRef.current = finalizeAuthenticatedSession;

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
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

    const applySignedIn = (fbUser: User): void => {
      void finalizeAuthenticatedSessionRef.current(mapFirebaseUser(fbUser));
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
        await auth.authStateReady();
        if (cancelled || auth.currentUser) return;
        if (isFirebaseAuthRedirectReturn()) return;
        setIsSessionLoading(false);

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
      const redirectUser =
        Platform.OS === 'web' ? await startFirebaseRedirectSignIn() : null;
      await auth.authStateReady();
      authInitializedRef.current = true;
      if (cancelled) return;

      if (auth.currentUser) {
        applySignedIn(auth.currentUser);
        clearFirebaseAuthParamsFromWindow();
      } else if (redirectUser) {
        void finalizeAuthenticatedSessionRef.current(redirectUser);
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
        syncManager.setAuthAvailable(Boolean(auth.currentUser));
      } else {
        applyLocalOfflineSession();
      }
    })();

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (cancelled) return;

      if (fbUser) {
        applySignedIn(fbUser);
        clearFirebaseAuthParamsFromWindow();
        return;
      }

      if (!authInitializedRef.current || isFirebaseAuthRedirectReturn()) {
        return;
      }

      confirmSignedOut();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const signInWithGoogle = useCallback(async (idToken?: string): Promise<boolean> => {
    if (!firebaseEnabled) {
      throw new Error(
        'Configure o Firebase no arquivo .env (veja .env.example) antes de entrar com Google.',
      );
    }
    if (idToken) {
      const signedIn = await signInWithGoogleCredential(idToken);
      await finalizeAuthenticatedSession(signedIn);
      await waitForAuthenticatedUid(20_000);
      return false;
    }
    if (Platform.OS !== 'web') {
      throw new Error('No dispositivo móvel, use o botão Entrar com Google.');
    }
    const result = await signInWithGoogleWeb();
    if (result.mode === 'redirect') return true;
    if (result.mode === 'popup') {
      await finalizeAuthenticatedSession(result.user);
    }
    await waitForAuthenticatedUid(20_000);
    return false;
  }, [finalizeAuthenticatedSession, firebaseEnabled]);

  const syncLocalSessionFlags = useCallback(() => {
    const loginUid = getCachedLoginUid();
    const ownerUid = getCachedDataOwnerUid();
    if (!loginUid || !ownerUid) return;
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(ownerUid !== loginUid);
  }, []);

  const logout = useCallback(async () => {
    const ownerBeforeLogout = getCachedDataOwnerUid();
    await signOutFirebase();
    setUser(null);
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
      firebaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithGoogle,
      logout,
      syncLocalSessionFlags,
    }),
    [
      user,
      authReady,
      isSessionLoading,
      firebaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithGoogle,
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
