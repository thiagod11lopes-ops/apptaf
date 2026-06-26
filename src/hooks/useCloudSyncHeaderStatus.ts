import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOfflineSyncState } from '../contexts/OfflineSyncContext';
import { useAccountCloudLabel } from './useAccountCloudLabel';
import {
  getCloudActivityState,
  subscribeCloudActivity,
} from '../services/offline/cloudSyncActivity';
import { isAwaitingCloudConfirmation, subscribeCloudDisplayGate } from '../offline-first/sync/cloudDisplayGate';
import type { CloudUserLoadProps } from '../components/sismav/AppHeader';

export function useCloudSyncHeaderStatus(cloudLoad?: CloudUserLoadProps) {
  const { isAuthenticated } = useAuth();
  const accountLabel = useAccountCloudLabel();
  const { syncing: syncingContext, pendingCount, online } = useOfflineSyncState();
  const [activity, setActivity] = useState(getCloudActivityState);
  const [awaitingCloud, setAwaitingCloud] = useState(isAwaitingCloudConfirmation);

  useEffect(() => subscribeCloudActivity(setActivity), []);
  useEffect(() => subscribeCloudDisplayGate(() => setAwaitingCloud(isAwaitingCloudConfirmation())), []);

  const isOnlineAccount = isAuthenticated && accountLabel !== 'Offline';
  const effectiveOnline = online;

  const syncingCloud =
    isOnlineAccount &&
    effectiveOnline &&
    (activity.syncing || syncingContext);

  const applyingRemote = isOnlineAccount && effectiveOnline && activity.realtimeApplying;

  const pendingUploading =
    isOnlineAccount &&
    effectiveOnline &&
    pendingCount > 0 &&
    !syncingCloud;

  const uploadingCloud =
    isOnlineAccount && effectiveOnline && (activity.uploading || pendingUploading) && !syncingCloud;

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
    if (uploadingCloud || (pendingCount > 0 && effectiveOnline)) return 'enviando para a nuvem';
    return null;
  }, [isOnlineAccount, effectiveOnline, pendingCount, syncingCloud, uploadingCloud]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  /** Exibindo somente dados confirmados da nuvem (nuvem verde). */
  const receivingFromCloudOnly = syncedWithCloud;

  const statusHint = useMemo(() => {
    if (!isAuthenticated || accountLabel === 'Offline') return null;
    if (!effectiveOnline) return 'Sem conexão · dados locais disponíveis';
    if (syncingCloud || loadingInitial) return 'Baixando e reconciliando dados com a nuvem…';
    if (applyingRemote) return 'Atualizando dados recebidos da nuvem…';
    if (uploadingCloud || (pendingCount > 0 && effectiveOnline)) {
      return 'Enviando alterações para a nuvem em tempo real…';
    }
    if (awaitingCloud && pendingCount > 0) {
      return 'Enviando alterações locais para a nuvem…';
    }
    if (awaitingCloud) return 'Conectando com a nuvem…';
    if (syncedWithCloud && realtimeActive) return 'Dados sincronizados em tempo real com a nuvem';
    if (syncedWithCloud) return 'Dados sincronizados de acordo com a nuvem';
    if (cloudConnected) return 'Conectado à nuvem em tempo real';
    return 'Exibindo cache local · aguardando confirmação da nuvem';
  }, [
    isAuthenticated,
    accountLabel,
    effectiveOnline,
    syncingCloud,
    loadingInitial,
    applyingRemote,
    uploadingCloud,
    pendingCount,
    syncedWithCloud,
    realtimeActive,
    cloudConnected,
    awaitingCloud,
  ]);

  const percent = loadingInitial
    ? (cloudLoad?.percent ?? 0)
    : syncingCloud
      ? Math.max(activity.syncProgress, 12)
      : uploadingCloud
        ? 72
        : pendingUploading
          ? 68
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
