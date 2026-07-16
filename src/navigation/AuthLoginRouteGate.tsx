import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingAuthCallback } from '../services/firebase/googleAuth';
import { getCurrentRouteName, navigateTab, navigationRef } from '../navigation/navigationRef';

/** Durante callback de recuperação/confirmação mantém Conta; após login abre a Home. */
export function AuthLoginRouteGate() {
  const { isAuthenticated, isSessionLoading, passwordRecoveryPending } = useAuth();
  const wasAuthenticatedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!navigationRef.isReady()) return;

    if (wasAuthenticatedRef.current === null) {
      wasAuthenticatedRef.current = isAuthenticated;
    }

    if (hasPendingAuthCallback() || isSessionLoading || passwordRecoveryPending) {
      if (getCurrentRouteName() !== 'Login') {
        navigateTab('Login');
      }
      return;
    }

    const justSignedIn = isAuthenticated && wasAuthenticatedRef.current === false;
    wasAuthenticatedRef.current = isAuthenticated;

    if (justSignedIn) {
      navigateTab('Home');
    }
  }, [isAuthenticated, isSessionLoading, passwordRecoveryPending]);

  return null;
}
