import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingGoogleOAuthReturn } from '../services/firebase/googleAuth';
import { getCurrentRouteName, navigateTab, navigationRef } from '../navigation/navigationRef';

/** Mantém o usuário na tela Conta durante login Google e retorno OAuth. */
export function AuthLoginRouteGate() {
  const { isSessionLoading } = useAuth();

  useEffect(() => {
    if (!navigationRef.isReady()) return;
    if (hasPendingGoogleOAuthReturn() || isSessionLoading) {
      if (getCurrentRouteName() !== 'Login') {
        navigateTab('Login');
      }
    }
  }, [isSessionLoading]);

  return null;
}
