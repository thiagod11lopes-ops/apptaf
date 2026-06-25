import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useAccountCloudLabel } from './useAccountCloudLabel';
import {
  getCloudActivityState,
  subscribeCloudActivity,
} from '../services/offline/cloudSyncActivity';
import type { CloudUserLoadProps } from '../components/sismav/AppHeader';

export function useCloudSyncHeaderStatus(cloudLoad?: CloudUserLoadProps) {
  const { isAuthenticated } = useAuth();
  const accountLabel = useAccountCloudLabel();
  const { syncing: syncingContext, pendingCount, online } = useOfflineSyncState();
  const [activity, setActivity] = useState(getCloudActivityState);

  useEffect(() => subscribeCloudActivity(setActivity), []);

  const isOnlineAccount = isAuthenticated && accountLabel !== 'Offline';

  const syncingCloud =
    isOnlineAccount &&
    online &&
    (activity.syncing || syncingContext);

  const applyingRemote = isOnlineAccount && online && activity.realtimeApplying;

  const uploadingCloud =
    isOnlineAccount && online && activity.uploading && !syncingCloud;

  const realtimeActive = isOnlineAccount && online && activity.realtimeListening;

  const loadingInitial = isOnlineAccount && online && (cloudLoad?.loading ?? false);
  const loading = loadingInitial || syncingCloud || uploadingCloud;

  const syncedWithCloud =
    isOnlineAccount &&
    online &&
    !loading &&
    pendingCount === 0 &&
    activity.cloudReady;

  const statusSuffix = useMemo(() => {
    if (!isOnlineAccount) return null;
    if (syncingCloud) return 'sincronizando com a nuvem';
    if (uploadingCloud) return 'enviando para a nuvem';
    if (pendingCount > 0 && online) return `${pendingCount} na fila`;
    return null;
  }, [isOnlineAccount, online, pendingCount, syncingCloud, uploadingCloud]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  /** Exibindo somente dados confirmados da nuvem (nuvem verde). */
  const receivingFromCloudOnly = syncedWithCloud;

  const statusHint = useMemo(() => {
    if (!isOnlineAccount) return null;
    if (!online) return null;
    if (syncingCloud || loadingInitial) return 'Baixando e reconciliando dados com a nuvem…';
    if (applyingRemote) return 'Atualizando dados recebidos da nuvem…';
    if (uploadingCloud) return 'Dados sendo atualizados na nuvem em tempo real';
    if (pendingCount > 0) return 'Alterações locais aguardando envio à nuvem';
    if (syncedWithCloud && realtimeActive) return 'Dados sincronizados em tempo real com a nuvem';
    if (syncedWithCloud) return 'Dados sincronizados de acordo com a nuvem';
    return 'Exibindo cache local · aguardando confirmação da nuvem';
  }, [
    isOnlineAccount,
    online,
    syncingCloud,
    loadingInitial,
    applyingRemote,
    uploadingCloud,
    pendingCount,
    syncedWithCloud,
    realtimeActive,
  ]);

  const percent = loadingInitial
    ? (cloudLoad?.percent ?? 0)
    : syncingCloud
      ? Math.max(activity.syncProgress, 12)
      : uploadingCloud
        ? 72
        : 100;

  return {
    accountLabel,
    label,
    statusSuffix,
    loading,
    percent,
    uploading: uploadingCloud,
    syncing: syncingCloud,
    syncedWithCloud,
    receivingFromCloudOnly,
    statusHint,
    isOnlineAccount,
  };
}
