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
import { setAuthUidState, waitForAuthenticatedUid, getCachedDataOwnerUid, getCachedLoginUid } from '../services/firebase/authUid';
import {
  clearPersistedAuthProfile,
  persistAuthProfile,
  readPersistedAuthProfile,
} from '../services/firebase/authProfile';
import { clearMemoryCloudCache } from '../services/cloudDataCache';
import { syncEngine, notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
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

function resolveMemberFlag(mappedUid: string): boolean {
  const persistedOwner = getCachedDataOwnerUid();
  return persistedOwner != null && persistedOwner !== mappedUid;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(hydrateInitialUser);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isAuthorizedMember, setIsAuthorizedMember] = useState(false);
  const firebaseEnabled = isFirebaseConfigured();
  const authInitializedRef = useRef(false);

  const applySignedInAppUser = useCallback((mapped: AppAuthUser) => {
    const persistedOwner = getCachedDataOwnerUid();
    const dataOwnerUid = persistedOwner ?? mapped.uid;
    setUser(mapped);
    setIsAuthorizedMember(resolveMemberFlag(mapped.uid));
    setAuthUidState(mapped.uid, dataOwnerUid, true);
    persistAuthProfile(mapped);
    clearPendingSyncResume();
    setAuthReady(true);
  }, []);

  const applySignedInAppUserRef = useRef(applySignedInAppUser);
  applySignedInAppUserRef.current = applySignedInAppUser;

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      setAuthUidState(null, null, true);
      return;
    }

    let cancelled = false;

    const applySignedIn = (fbUser: User): void => {
      applySignedInAppUserRef.current(mapFirebaseUser(fbUser));
    };

    const applySignedOut = (): void => {
      setUser(null);
      setIsAuthorizedMember(false);
      setAuthUidState(null, null, true);
      clearPersistedAuthProfile();
      setAuthReady(true);
      void systemState.setOfflineMode();
    };

    const confirmSignedOut = (): void => {
      void (async () => {
        await auth.authStateReady();
        if (cancelled || auth.currentUser) return;
        if (isFirebaseAuthRedirectReturn()) return;
        setIsSessionLoading(false);
        applySignedOut();
      })();
    };

    void (async () => {
      const redirectUser =
        Platform.OS === 'web' ? await startFirebaseRedirectSignIn() : null;
      await auth.authStateReady();
      authInitializedRef.current = true;
      if (cancelled) return;

      if (auth.currentUser) {
        applySignedIn(auth.currentUser);
        clearFirebaseAuthParamsFromWindow();
      } else if (redirectUser) {
        applySignedInAppUserRef.current(redirectUser);
      } else if (isFirebaseAuthRedirectReturn()) {
        setAuthReady(true);
      } else {
        applySignedOut();
      }
    })();

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (cancelled) return;

      if (fbUser) {
        setIsSessionLoading(true);
        try {
          applySignedIn(fbUser);
          clearFirebaseAuthParamsFromWindow();
        } finally {
          setIsSessionLoading(false);
        }
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
      applySignedInAppUser(signedIn);
      await waitForAuthenticatedUid(20_000);
      return false;
    }
    if (Platform.OS !== 'web') {
      throw new Error('No dispositivo móvel, use o botão Entrar com Google.');
    }
    const result = await signInWithGoogleWeb();
    if (result.mode === 'redirect') return true;
    if (result.mode === 'popup') {
      applySignedInAppUser(result.user);
    }
    await waitForAuthenticatedUid(20_000);
    return false;
  }, [applySignedInAppUser, firebaseEnabled]);

  const syncLocalSessionFlags = useCallback(() => {
    const loginUid = getCachedLoginUid();
    const ownerUid = getCachedDataOwnerUid();
    if (!loginUid || !ownerUid) return;
    setIsAuthorizedMember(ownerUid !== loginUid);
  }, []);

  const logout = useCallback(async () => {
    await signOutFirebase();
    setUser(null);
    setIsAuthorizedMember(false);
    setAuthUidState(null, null, true);
    clearPersistedAuthProfile();
    clearMemoryCloudCache();
    resetCloudSyncStatus();
    confirmCloudDisplayReady();
    syncEngine.shutdown();
    await syncManager.shutdown();
    await systemState.setOfflineMode();
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
      isBoss,
      isAuthorizedMember,
      signInWithGoogle,
      logout,
      syncLocalSessionFlags,
    }),
    [user, authReady, isSessionLoading, firebaseEnabled, isBoss, isAuthorizedMember, signInWithGoogle, logout, syncLocalSessionFlags],
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
