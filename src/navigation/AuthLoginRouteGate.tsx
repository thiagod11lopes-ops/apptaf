import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPendingGoogleOAuthReturn } from '../services/firebase/googleAuth';
import { getCurrentRouteName, navigateTab, navigationRef } from '../navigation/navigationRef';

/** Durante OAuth/login mantém Conta; após conectar Google abre a Home. */
export function AuthLoginRouteGate() {
  const { isAuthenticated, isSessionLoading } = useAuth();
  const wasAuthenticatedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!navigationRef.isReady()) return;

    if (wasAuthenticatedRef.current === null) {
      wasAuthenticatedRef.current = isAuthenticated;
    }

    if (hasPendingGoogleOAuthReturn() || isSessionLoading) {
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
  }, [isAuthenticated, isSessionLoading]);

  return null;
}
