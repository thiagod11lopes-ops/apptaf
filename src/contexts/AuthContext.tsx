import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  type AuthSession,
} from '../services/authSession';

type AuthContextType = {
  user: AuthSession | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    loadAuthSession()
      .then(setUser)
      .finally(() => setAuthReady(true));
  }, []);

  const login = useCallback(async (usuario: string, senha: string) => {
    const nome = usuario.trim();
    if (!nome) {
      throw new Error('Informe o usuário.');
    }
    if (!senha.trim()) {
      throw new Error('Informe a senha.');
    }
    const session = { usuario: nome };
    await saveAuthSession(session);
    setUser(session);
  }, []);

  const logout = useCallback(async () => {
    await clearAuthSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      login,
      logout,
    }),
    [user, authReady, login, logout],
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
