import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { subscribeDataChanged } from '../offline-first/sync/SyncEngine';

const DATA_CHANGE_DEBOUNCE_MS = 800;

/** Recarrega dados quando a tela ganha foco, login muda ou a nuvem atualiza o cache. */
export function useAuthDataReload(reload: () => void | Promise<void>) {
  const { user, authReady, isAuthenticated, isAuthorizedMember, dataOwnerUid } = useAuth();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const inFlightRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runReload = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await reloadRef.current();
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!authReady) return;
      void runReload();
    }, [authReady, runReload, user?.uid, isAuthorizedMember, dataOwnerUid]),
  );

  useEffect(() => {
    if (!authReady) return;
    return subscribeDataChanged(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void runReload();
      }, DATA_CHANGE_DEBOUNCE_MS);
    });
  }, [authReady, runReload]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
}
