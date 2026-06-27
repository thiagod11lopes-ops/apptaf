import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { isFirebaseConfigured, getFirebaseAuth } from '../config/firebase';
import {
  mapFirebaseUser,
  signInWithGoogleCredential,
  signInWithGoogleWeb,
  completeGoogleRedirectSignIn,
  signOutFirebase,
  type AppAuthUser,
} from '../services/firebase/googleAuth';
import { setAuthUidState, waitForAuthenticatedUid, getCachedDataOwnerUid, getCachedLoginUid } from '../services/firebase/authUid';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isAuthorizedMember, setIsAuthorizedMember] = useState(false);
  const firebaseEnabled = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      setAuthUidState(null, null, true);
      return;
    }

    let unsub = () => {};
    let disposed = false;

    void (async () => {
      if (Platform.OS === 'web') {
        await completeGoogleRedirectSignIn();
      }

      await auth.authStateReady();
      if (disposed) return;

      unsub = onAuthStateChanged(auth, (fbUser) => {
        void (async () => {
          if (!fbUser) {
            setIsSessionLoading(false);
            setUser(null);
            setIsAuthorizedMember(false);
            setAuthUidState(null, null, true);
            setAuthReady(true);
            void systemState.setOfflineMode();
            return;
          }

          setIsSessionLoading(true);
          try {
            const mapped = mapFirebaseUser(fbUser);
            const persistedOwner = getCachedDataOwnerUid();
            const dataOwnerUid = persistedOwner ?? mapped.uid;
            const isMember = persistedOwner != null && persistedOwner !== mapped.uid;
            setUser(mapped);
            setIsAuthorizedMember(isMember);
            setAuthUidState(mapped.uid, dataOwnerUid, true);
            clearPendingSyncResume();
            setAuthReady(true);
          } finally {
            setIsSessionLoading(false);
          }
        })();
      });
    })();

    return () => {
      disposed = true;
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
      await signInWithGoogleCredential(idToken);
      await waitForAuthenticatedUid(20_000);
      return false;
    }
    if (Platform.OS !== 'web') {
      throw new Error('No dispositivo móvel, use o botão Entrar com Google.');
    }
    const result = await signInWithGoogleWeb();
    if (result.mode === 'redirect') return true;
    await waitForAuthenticatedUid(20_000);
    return false;
  }, [firebaseEnabled]);

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
