import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { emailCloudLabel } from '../utils/emailCloudLabel';

/** Rótulo de conta: e-mail logado ou "Offline" (sem login Google). */
export function useAccountCloudLabel(): string {
  const { isAuthenticated, user } = useAuth();

  return useMemo(() => {
    if (!isAuthenticated) return 'Offline';
    return emailCloudLabel(user?.email ?? null) ?? 'Offline';
  }, [isAuthenticated, user?.email]);
}
