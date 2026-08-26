import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingAuthCallback } from '../services/firebase/googleAuth';
import { getCurrentRouteName, navigateTab, navigationRef } from '../navigation/navigationRef';

const PUBLIC_ROUTES = new Set(['Login', 'AgendamentoPublico']);

/**
 * Exige login antes do app (Iniciar e demais abas).
 * Após autenticação confirmada, redireciona para a Home.
 */
export function AuthLoginRouteGate() {
  const { authReady, isAuthenticated, isSessionLoading, passwordRecoveryPending } = useAuth();
  const wasAuthenticatedRef = useRef<boolean | null>(null);
  const goHomeWhenSessionReadyRef = useRef(false);

  useEffect(() => {
    if (!navigationRef.isReady() || !authReady) return;

    const route = getCurrentRouteName();

    if (passwordRecoveryPending || hasPendingAuthCallback()) {
      goHomeWhenSessionReadyRef.current = false;
      if (route !== 'Login') {
        navigateTab('Login');
      }
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    if (!isAuthenticated) {
      goHomeWhenSessionReadyRef.current = false;
      wasAuthenticatedRef.current = false;
      if (!PUBLIC_ROUTES.has(route)) {
        navigateTab('Login');
      }
      return;
    }

    if (wasAuthenticatedRef.current === null) {
      wasAuthenticatedRef.current = true;
      if (isSessionLoading) {
        goHomeWhenSessionReadyRef.current = true;
      }
      return;
    }

    const wasAuthenticated = wasAuthenticatedRef.current;

    if (!wasAuthenticated) {
      goHomeWhenSessionReadyRef.current = true;
    }

    wasAuthenticatedRef.current = true;

    if (goHomeWhenSessionReadyRef.current && !isSessionLoading) {
      goHomeWhenSessionReadyRef.current = false;
      if (route === 'Login' || route === 'MainTabs') {
        navigateTab('Home');
      }
    }
  }, [authReady, isAuthenticated, isSessionLoading, passwordRecoveryPending]);

  return null;
}
