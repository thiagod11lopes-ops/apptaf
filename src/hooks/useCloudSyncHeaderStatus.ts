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
  const {
    syncing: syncingContext,
    pendingCount,
    online,
    usingCloudData,
    syncModalVisible,
    uploadError,
  } = useOfflineSyncState();
  const [activity, setActivity] = useState(getCloudActivityState);
  const [awaitingCloud, setAwaitingCloud] = useState(isAwaitingCloudConfirmation);

  useEffect(() => subscribeCloudActivity(setActivity), []);
  useEffect(() => subscribeCloudDisplayGate(() => setAwaitingCloud(isAwaitingCloudConfirmation())), []);

  const isOnlineAccount = isAuthenticated && accountLabel !== 'Offline';
  const effectiveOnline = online;

  const syncingCloud =
    isOnlineAccount &&
    effectiveOnline &&
    usingCloudData &&
    (activity.syncing || syncingContext);

  const applyingRemote = isOnlineAccount && effectiveOnline && usingCloudData && activity.realtimeApplying;

  const pendingUploading =
    isOnlineAccount &&
    effectiveOnline &&
    usingCloudData &&
    pendingCount > 0 &&
    !syncingCloud;

  const uploadingCloud =
    isOnlineAccount &&
    effectiveOnline &&
    usingCloudData &&
    (activity.uploading || pendingUploading) &&
    !syncingCloud;

  const realtimeActive = isOnlineAccount && effectiveOnline && usingCloudData && activity.realtimeListening;

  const loadingInitial = isOnlineAccount && effectiveOnline && usingCloudData && (cloudLoad?.loading ?? false);
  const loading = loadingInitial || syncingCloud || uploadingCloud;

  const cloudConnected =
    isOnlineAccount &&
    effectiveOnline &&
    usingCloudData &&
    (activity.cloudReady || activity.realtimeListening);

  const syncedWithCloud =
    isOnlineAccount &&
    effectiveOnline &&
    usingCloudData &&
    !loading &&
    pendingCount === 0 &&
    cloudConnected;

  const statusSuffix = useMemo(() => {
    if (!isOnlineAccount) return null;
    if (!effectiveOnline) return 'dados locais';
    if (uploadError) return 'falha ao enviar';
    if (!usingCloudData && pendingCount > 0) return 'dados locais · pendências';
    if (syncingCloud) return 'sincronizando com a nuvem';
    if (uploadingCloud) return 'enviando para a nuvem';
    return null;
  }, [isOnlineAccount, effectiveOnline, usingCloudData, pendingCount, syncingCloud, uploadingCloud, uploadError]);

  const label = statusSuffix ? `${accountLabel} · ${statusSuffix}` : accountLabel;

  const receivingFromCloudOnly = syncedWithCloud;

  const statusHint = useMemo(() => {
    if (!isAuthenticated || accountLabel === 'Offline') return null;
    if (!effectiveOnline) return 'Sem conexão · exibindo dados do IndexedDB local';
    if (uploadError) return uploadError;
    if (syncModalVisible) return 'Alterações locais aguardando envio para a nuvem…';
    if (!usingCloudData && pendingCount > 0) {
      return 'Com conexão · exibindo dados locais (alterações pendentes de envio)';
    }
    if (!usingCloudData) return 'Exibindo dados locais do dispositivo';
    if (syncingCloud || loadingInitial) return 'Baixando dados da nuvem…';
    if (applyingRemote) return 'Atualizando dados recebidos da nuvem…';
    if (uploadingCloud) return 'Enviando alteração para a nuvem…';
    if (awaitingCloud) return 'Conectando com a nuvem…';
    if (syncedWithCloud && realtimeActive) return 'Dados da nuvem em tempo real';
    if (syncedWithCloud) return 'Dados sincronizados com a nuvem';
    if (cloudConnected) return 'Conectado à nuvem';
    return 'Carregando dados da nuvem…';
  }, [
    isAuthenticated,
    accountLabel,
    effectiveOnline,
    usingCloudData,
    uploadError,
    syncModalVisible,
    pendingCount,
    syncingCloud,
    loadingInitial,
    applyingRemote,
    uploadingCloud,
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
    usingCloudData,
  };
}
