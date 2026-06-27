import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { emailCloudLabel } from '../utils/emailCloudLabel';

/** Rótulo de conta: offline por padrão; e-mail só quando logado. */
export function useAccountCloudLabel(): string {
  const { isAuthenticated, user } = useAuth();
  const { appMode } = useOfflineSyncState();

  return useMemo(() => {
    if (appMode !== 'OFFLINE') return 'Sincronizando…';
    if (!isAuthenticated) return 'Modo offline';
    return emailCloudLabel(user?.email ?? null) ?? 'Modo offline';
  }, [appMode, isAuthenticated, user?.email]);
}
