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
import { setAuthUidState } from '../services/firebase/authUid';
import { clearMemoryCloudCache, clearCloudDataCache } from '../services/cloudDataCache';

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  firebaseEnabled: boolean;
  signInWithGoogle: (idToken?: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const firebaseEnabled = isFirebaseConfigured();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthReady(true);
      setAuthUidState(null, true);
      return;
    }

    let unsub = () => {};

    void (async () => {
      if (Platform.OS === 'web') {
        await completeGoogleRedirectSignIn();
      }

      unsub = onAuthStateChanged(auth, (fbUser) => {
        const uid = fbUser?.uid ?? null;
        setUser(fbUser ? mapFirebaseUser(fbUser) : null);
        setAuthReady(true);
        setAuthUidState(uid, true);
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

  const logout = useCallback(async () => {
    const uid = user?.uid;
    await signOutFirebase();
    setUser(null);
    setAuthUidState(null, true);
    clearMemoryCloudCache();
    if (uid) {
      await clearCloudDataCache(uid);
    }
  }, [user?.uid]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      firebaseEnabled,
      signInWithGoogle,
      logout,
    }),
    [user, authReady, firebaseEnabled, signInWithGoogle, logout],
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
