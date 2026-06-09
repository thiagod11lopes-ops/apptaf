import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { subscribeOnlineStatus } from '../services/offline/networkStatus';
import { triggerBackgroundSync } from '../services/offline/offlineCloudEngine';

/** Sincroniza dados da nuvem ao voltar online ou ao reabrir o app. */
export function useOfflineSync(): void {
  const { isAuthenticated, authReady } = useAuth();

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;

    const sync = () => {
      const uid = getCachedDataOwnerUid();
      triggerBackgroundSync(uid);
    };

    sync();
    const unsubOnline = subscribeOnlineStatus((online) => {
      if (online) sync();
    });

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      unsubOnline();
      sub.remove();
    };
  }, [authReady, isAuthenticated]);
}
