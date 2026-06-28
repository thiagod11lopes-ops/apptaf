import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useAccountCloudLabel } from './useAccountCloudLabel';
import type { CloudUserLoadProps } from '../components/sismav/AppHeader';

export function useCloudSyncHeaderStatus(_cloudLoad?: CloudUserLoadProps) {
  const { isAuthenticated } = useAuth();
  const accountLabel = useAccountCloudLabel();
  const {
    syncing,
    pendingCount,
    online,
    appMode,
    uploadError,
  } = useOfflineSyncState();

  const isOfflineMode = appMode === 'OFFLINE';
  const syncInProgress =
    appMode === 'ONLINE_PREPARING' || appMode === 'ONLINE_SYNCING' || syncing;

  const loading = false;

  const syncedWithCloud = false;

  const statusSuffix = useMemo(() => {
    if (syncInProgress) return null;
    if (pendingCount > 0) return `${pendingCount} pendente(s)`;
    return null;
  }, [syncInProgress, pendingCount]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  const statusHint = useMemo(() => {
    if (syncInProgress) return null;
    if (uploadError) return uploadError;
    if (pendingCount > 0) {
      return `${pendingCount} alteração(ões) local(is) · use a chave na tela inicial`;
    }
    if (isAuthenticated && isOfflineMode) {
      return 'Modo offline';
    }
    if (!online) return 'Sem internet · operação 100% local';
    return 'Modo offline · use a chave na tela inicial para sincronizar';
  }, [
    syncInProgress,
    uploadError,
    pendingCount,
    isAuthenticated,
    isOfflineMode,
    online,
  ]);

  return {
    accountLabel,
    label,
    statusSuffix,
    loading,
    percent: 100,
    uploading: false,
    syncing: false,
    syncedWithCloud,
    receivingFromCloudOnly: false,
    statusHint,
    cloudDiffFlashMessage: null,
    isOnlineAccount: isAuthenticated,
    usingCloudData: false,
  };
}
