import { useEffect, useMemo, useState } from 'react';
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
    syncModalVisible,
    uploadError,
  } = useOfflineSyncState();

  const isOfflineMode = appMode === 'OFFLINE';

  const loading = appMode === 'ONLINE_PREPARING' || appMode === 'ONLINE_SYNCING' || syncing;

  const syncedWithCloud = false;

  const statusSuffix = useMemo(() => {
    if (appMode === 'ONLINE_SYNCING') return 'sincronizando';
    if (appMode === 'ONLINE_PREPARING') return 'preparando sync';
    if (pendingCount > 0) return `${pendingCount} pendente(s)`;
    return null;
  }, [appMode, pendingCount]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  const statusHint = useMemo(() => {
    if (uploadError) return uploadError;
    if (syncModalVisible) return 'Revise o relatório e confirme a sincronização';
    if (appMode === 'ONLINE_SYNCING') return 'Enviando e baixando diferenças…';
    if (appMode === 'ONLINE_PREPARING') return 'Comparando dados locais com a nuvem…';
    if (pendingCount > 0) {
      return `${pendingCount} alteração(ões) local(is) · sincronize em Configurações`;
    }
    if (isAuthenticated && isOfflineMode) {
      return 'Modo offline · dados locais (IndexedDB)';
    }
    if (!online) return 'Sem internet · operação 100% local';
    return 'Modo offline · use Configurações para sincronizar';
  }, [
    uploadError,
    syncModalVisible,
    appMode,
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
    percent: loading ? 55 : 100,
    uploading: appMode === 'ONLINE_SYNCING',
    syncing: loading,
    syncedWithCloud,
    receivingFromCloudOnly: false,
    statusHint,
    isOnlineAccount: isAuthenticated,
    usingCloudData: false,
  };
}
