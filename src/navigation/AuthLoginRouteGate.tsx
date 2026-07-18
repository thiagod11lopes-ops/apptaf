import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingAuthCallback } from '../services/firebase/googleAuth';
import { getCurrentRouteName, navigateTab, navigationRef } from '../navigation/navigationRef';

/**
 * Após login confirmado (sessão pronta), vai automaticamente para a Home.
 * Recuperação de senha / callback de e-mail mantém a tela Conta.
 */
export function AuthLoginRouteGate() {
  const { isAuthenticated, isSessionLoading, passwordRecoveryPending } = useAuth();
  const wasAuthenticatedRef = useRef<boolean | null>(null);
  const goHomeWhenSessionReadyRef = useRef(false);

  useEffect(() => {
    if (!navigationRef.isReady()) return;

    // Recuperação / link de e-mail: fica em Conta.
    if (passwordRecoveryPending || hasPendingAuthCallback()) {
      goHomeWhenSessionReadyRef.current = false;
      if (getCurrentRouteName() !== 'Login') {
        navigateTab('Login');
      }
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    if (wasAuthenticatedRef.current === null) {
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    const wasAuthenticated = wasAuthenticatedRef.current;

    // Login acabou de confirmar — espera a sessão preparar e então vai à Home.
    if (isAuthenticated && !wasAuthenticated) {
      goHomeWhenSessionReadyRef.current = true;
    }

    if (!isAuthenticated) {
      goHomeWhenSessionReadyRef.current = false;
      wasAuthenticatedRef.current = false;
      return;
    }

    wasAuthenticatedRef.current = true;

    if (goHomeWhenSessionReadyRef.current && !isSessionLoading) {
      goHomeWhenSessionReadyRef.current = false;
      navigateTab('Home');
    }
  }, [isAuthenticated, isSessionLoading, passwordRecoveryPending]);

  return null;
}
