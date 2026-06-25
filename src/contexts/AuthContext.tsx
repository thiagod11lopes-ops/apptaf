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
import { resolveMemberAccess, registerAuthorizedMemberLogin } from '../services/firebase/authorizedEmailsFirestore';
import { setAuthUidState } from '../services/firebase/authUid';
import { clearMemoryCloudCache } from '../services/cloudDataCache';
import { migrateDeviceDataOnLogin, migrateLegacyToDexie } from '../offline-first/db/migration';
import { syncEngine, notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { connectivityMonitor } from '../offline-first/sync/ConnectivityMonitor';
import { applyTeamWipeIfNeeded } from '../services/applyTeamWipeIfNeeded';
import { resetCloudSyncStatus } from '../services/offline/cloudSyncActivity';
import { stopRealtimeSync } from '../offline-first/sync/RealtimeBridge';
import { systemState } from '../offline-first/sync/SystemState';

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  firebaseEnabled: boolean;
  /** Chefe da conta — pode gerenciar e-mails autorizados e carregar planilha. */
  isBoss: boolean;
  /** Entrou com e-mail autorizado pelo chefe — usa banco do chefe. */
  isAuthorizedMember: boolean;
  signInWithGoogle: (idToken?: string) => Promise<boolean>;
  logout: (options?: { preserveForcedOffline?: boolean }) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
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

    void (async () => {
      if (Platform.OS === 'web') {
        await completeGoogleRedirectSignIn();
      }

      unsub = onAuthStateChanged(auth, (fbUser) => {
        void (async () => {
          if (!fbUser) {
            setUser(null);
            setIsAuthorizedMember(false);
            setAuthUidState(null, null, true);
            setAuthReady(true);
            return;
          }

          const mapped = mapFirebaseUser(fbUser);
          const access = await resolveMemberAccess(mapped.uid, mapped.email);
          resetCloudSyncStatus();
          if (access.isAuthorizedMember && mapped.email) {
            await registerAuthorizedMemberLogin(access.dataOwnerUid, mapped.email, mapped.uid);
          }
          try {
            await applyTeamWipeIfNeeded(access.dataOwnerUid, mapped.uid);
            await migrateDeviceDataOnLogin(access.dataOwnerUid);
            await migrateLegacyToDexie(access.dataOwnerUid);
            await systemState.hydrate();
            const isBossLogin = !access.isAuthorizedMember;
            if (connectivityMonitor.canSync()) {
              await systemState.setOnlineActive();
            }
            await syncEngine.init(access.dataOwnerUid, {
              alwaysConnect: isBossLogin && connectivityMonitor.canSync(),
            });
          } catch {
            // Login continua; gate de sync reavalia após authReady.
          }
          setUser(mapped);
          setIsAuthorizedMember(access.isAuthorizedMember);
          setAuthUidState(mapped.uid, access.dataOwnerUid, true);
          setAuthReady(true);
        })();
      });
    })();

    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async (idToken?: string): Promise<boolean> => {
    if (!firebaseEnabled) {
      throw new Error(
        'Configure o Firebase no arquivo .env (veja .env.example) antes de entrar com Google.',
      );
    }
    if (idToken) {
      await signInWithGoogleCredential(idToken);
      return false;
    }
    if (Platform.OS !== 'web') {
      throw new Error('No dispositivo móvel, use o botão Entrar com Google.');
    }
    const result = await signInWithGoogleWeb();
    return result.mode === 'redirect';
  }, [firebaseEnabled]);

  const logout = useCallback(async (options?: { preserveForcedOffline?: boolean }) => {
    await signOutFirebase();
    setUser(null);
    setIsAuthorizedMember(false);
    setAuthUidState(null, null, true);
    clearMemoryCloudCache();
    resetCloudSyncStatus();
    syncEngine.shutdown();
    stopRealtimeSync();
    if (!options?.preserveForcedOffline) {
      void systemState.setOnlineActive();
    }
    notifyDataChanged();
  }, []);

  const isBoss = user != null && !isAuthorizedMember;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      firebaseEnabled,
      isBoss,
      isAuthorizedMember,
      signInWithGoogle,
      logout,
    }),
    [user, authReady, firebaseEnabled, isBoss, isAuthorizedMember, signInWithGoogle, logout],
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
