import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { subscribeOfflineData } from '../services/offline/offlineCloudEngine';

/** Recarrega dados quando a tela ganha foco, login muda ou a nuvem atualiza o cache. */
export function useAuthDataReload(reload: () => void | Promise<void>) {
  const { user, authReady, isAuthenticated, isAuthorizedMember } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!authReady) return;
      void reload();
    }, [authReady, reload, user?.uid, isAuthorizedMember]),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    return subscribeOfflineData(() => {
      void reload();
    });
  }, [isAuthenticated, reload]);
}
