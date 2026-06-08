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
import { clearLocalCadastros } from '../services/cadastrosIndexedDb';
import { clearLocalSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import { setAuthUidState } from '../services/firebase/authUid';

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  firebaseEnabled: boolean;
  signInWithGoogle: (idToken?: string) => Promise<void>;
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

    const unsub = onAuthStateChanged(auth, (fbUser) => {
      const uid = fbUser?.uid ?? null;
      setUser(fbUser ? mapFirebaseUser(fbUser) : null);
      setAuthReady(true);
      setAuthUidState(uid, true);
      if (fbUser) {
        void Promise.all([clearLocalCadastros(), clearLocalSessoesAplicacao()]);
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
    setAuthUidState(null, true);
  }, []);

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
