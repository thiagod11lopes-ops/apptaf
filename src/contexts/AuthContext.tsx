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
  signOutFirebase,
  type AppAuthUser,
} from '../services/firebase/googleAuth';
import {
  migrateLocalDataToCloud,
  type LocalCloudMigrationResult,
} from '../services/firebase/migrateLocalToCloud';

type SyncStatus = {
  running: boolean;
  result: LocalCloudMigrationResult | null;
  error: string | null;
};

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  firebaseEnabled: boolean;
  syncStatus: SyncStatus;
  signInWithGoogle: (idToken?: string) => Promise<void>;
  syncLocalDataToCloud: () => Promise<LocalCloudMigrationResult | null>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const INITIAL_SYNC: SyncStatus = { running: false, result: null, error: null };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(INITIAL_SYNC);
  const firebaseEnabled = isFirebaseConfigured();

  const syncLocalDataToCloud = useCallback(async () => {
    const auth = getFirebaseAuth();
    const uid = auth?.currentUser?.uid;
    if (!uid) return null;

    setSyncStatus((s) => ({ ...s, running: true, error: null }));
    try {
      const result = await migrateLocalDataToCloud(uid);
      setSyncStatus({ running: false, result, error: null });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível enviar os dados locais para a nuvem.';
      setSyncStatus({ running: false, result: null, error: message });
      throw e;
    }
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      return;
    }

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? mapFirebaseUser(fbUser) : null);
      setAuthReady(true);
      if (fbUser) {
        migrateLocalDataToCloud(fbUser.uid)
          .then((result) => setSyncStatus({ running: false, result, error: null }))
          .catch((e) => {
            const message =
              e instanceof Error ? e.message : 'Não foi possível enviar os dados locais para a nuvem.';
            setSyncStatus({ running: false, result: null, error: message });
          });
      } else {
        setSyncStatus(INITIAL_SYNC);
      }
    });
    return unsub;
  }, []);

  const signInWithGoogle = useCallback(async (idToken?: string) => {
    if (!firebaseEnabled) {
      throw new Error(
        'Configure o Firebase no arquivo .env (veja .env.example) antes de entrar com Google.',
      );
    }
    if (idToken) {
      await signInWithGoogleCredential(idToken);
      return;
    }
    if (Platform.OS !== 'web') {
      throw new Error('No dispositivo móvel, use o botão Entrar com Google.');
    }
    await signInWithGoogleWeb();
  }, [firebaseEnabled]);

  const logout = useCallback(async () => {
    await signOutFirebase();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      firebaseEnabled,
      syncStatus,
      signInWithGoogle,
      syncLocalDataToCloud,
      logout,
    }),
    [user, authReady, firebaseEnabled, syncStatus, signInWithGoogle, syncLocalDataToCloud, logout],
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
