import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeDataChanged,
  type DataChangeScope,
} from '../offline-first/sync/SyncEngine';

const DATA_CHANGE_DEBOUNCE_MS = 800;

export type AuthDataReloadOptions = {
  /** Se definido, só recarrega quando um desses escopos mudar (ou invalidação `all`). */
  scopes?: readonly DataChangeScope[];
};

/** Recarrega dados quando a tela ganha foco, login muda ou o storage notifica mudança. */
export function useAuthDataReload(
  reload: () => void | Promise<void>,
  options?: AuthDataReloadOptions,
) {
  const { user, authReady, isAuthorizedMember, dataOwnerUid } = useAuth();
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const scopesRef = useRef(options?.scopes);
  scopesRef.current = options?.scopes;
  const inFlightRef = useRef(false);
  const pendingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runReload = useCallback(async () => {
    if (inFlightRef.current) {
      pendingRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      do {
        pendingRef.current = false;
        await reloadRef.current();
      } while (pendingRef.current);
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
    const scopes = scopesRef.current;
    return subscribeDataChanged(
      () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          void runReload();
        }, DATA_CHANGE_DEBOUNCE_MS);
      },
      scopes != null && scopes.length > 0 ? { scopes } : undefined,
    );
  }, [authReady, runReload, options?.scopes?.join('|')]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );
}
