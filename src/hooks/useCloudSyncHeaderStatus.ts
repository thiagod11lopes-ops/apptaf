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
  const uploading =
    isOnlineAccount &&
    online &&
    (activity.uploading || activity.syncing || syncingContext);

  const loadingInitial = isOnlineAccount && online && (cloudLoad?.loading ?? false);
  const loading = loadingInitial || uploading;

  const label = useMemo(() => {
    if (!isOnlineAccount) return accountLabel;
    if (uploading) return `${accountLabel} · enviando para a nuvem`;
    if (pendingCount > 0 && online) return `${accountLabel} · ${pendingCount} na fila`;
    return accountLabel;
  }, [accountLabel, isOnlineAccount, online, pendingCount, uploading]);

  const percent = loadingInitial
    ? (cloudLoad?.percent ?? 0)
    : uploading
      ? 72
      : 100;

  return {
    label,
    loading,
    percent,
    uploading,
    isOnlineAccount,
  };
}
