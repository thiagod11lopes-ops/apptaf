import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useAccountCloudLabel } from './useAccountCloudLabel';
import {
  getCloudActivityState,
  subscribeCloudActivity,
} from '../services/offline/cloudSyncActivity';
import { isAwaitingCloudConfirmation } from '../offline-first/sync/cloudDisplayGate';
import type { CloudUserLoadProps } from '../components/sismav/AppHeader';

export function useCloudSyncHeaderStatus(cloudLoad?: CloudUserLoadProps) {
  const { isAuthenticated } = useAuth();
  const accountLabel = useAccountCloudLabel();
  const { syncing: syncingContext, pendingCount, online, isForcedOffline } = useOfflineSyncState();
  const [activity, setActivity] = useState(getCloudActivityState);

  useEffect(() => subscribeCloudActivity(setActivity), []);

  const isOnlineAccount = isAuthenticated && accountLabel !== 'Offline' && !isForcedOffline;

  const effectiveOnline = online && !isForcedOffline;

  const syncingCloud =
    isOnlineAccount &&
    effectiveOnline &&
    (activity.syncing || syncingContext);

  const applyingRemote = isOnlineAccount && effectiveOnline && activity.realtimeApplying;

  const uploadingCloud =
    isOnlineAccount && effectiveOnline && activity.uploading && !syncingCloud;

  const realtimeActive = isOnlineAccount && effectiveOnline && activity.realtimeListening;

  const loadingInitial = isOnlineAccount && effectiveOnline && (cloudLoad?.loading ?? false);
  const loading = loadingInitial || syncingCloud || uploadingCloud;

  const cloudConnected =
    isOnlineAccount && effectiveOnline && (activity.cloudReady || activity.realtimeListening);

  const syncedWithCloud =
    isOnlineAccount &&
    effectiveOnline &&
    !loading &&
    pendingCount === 0 &&
    cloudConnected;

  const statusSuffix = useMemo(() => {
    if (!isOnlineAccount) return null;
    if (syncingCloud) return 'sincronizando com a nuvem';
    if (uploadingCloud) return 'enviando para a nuvem';
    if (pendingCount > 0 && effectiveOnline) return `${pendingCount} na fila`;
    return null;
  }, [isOnlineAccount, effectiveOnline, pendingCount, syncingCloud, uploadingCloud]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  /** Exibindo somente dados confirmados da nuvem (nuvem verde). */
  const receivingFromCloudOnly = syncedWithCloud;

  const statusHint = useMemo(() => {
    if (!isAuthenticated || accountLabel === 'Offline') return null;
    if (isForcedOffline) return 'Modo offline controlado · dados locais completos';
    if (!effectiveOnline) return 'Sem conexão · dados da nuvem disponíveis localmente';
    if (syncingCloud || loadingInitial) return 'Baixando e reconciliando dados com a nuvem…';
    if (applyingRemote) return 'Atualizando dados recebidos da nuvem…';
    if (uploadingCloud) return 'Dados sendo atualizados na nuvem em tempo real';
    if (isAwaitingCloudConfirmation() && pendingCount > 0) {
      return 'Enviando alterações locais para a nuvem…';
    }
    if (isAwaitingCloudConfirmation()) return 'Conectando com a nuvem…';
    if (pendingCount > 0) return 'Alterações locais aguardando envio à nuvem';
    if (syncedWithCloud && realtimeActive) return 'Dados sincronizados em tempo real com a nuvem';
    if (syncedWithCloud) return 'Dados sincronizados de acordo com a nuvem';
    if (cloudConnected) return 'Conectado à nuvem em tempo real';
    return 'Exibindo cache local · aguardando confirmação da nuvem';
  }, [
    isAuthenticated,
    accountLabel,
    isForcedOffline,
    effectiveOnline,
    syncingCloud,
    loadingInitial,
    applyingRemote,
    uploadingCloud,
    pendingCount,
    syncedWithCloud,
    realtimeActive,
    cloudConnected,
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
