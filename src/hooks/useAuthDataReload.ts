import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

/** Recarrega dados quando a tela ganha foco ou quando o login muda. */
export function useAuthDataReload(reload: () => void | Promise<void>) {
  const { user, authReady } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!authReady) return;
      void reload();
    }, [authReady, reload, user?.uid]),
  );
}
