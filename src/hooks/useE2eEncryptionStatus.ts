import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isE2eKeyActive, subscribeActiveTeamKey } from '../services/supabase/e2eCrypto';
import { ensureE2eUnlockedForSession } from '../services/supabase/teamE2eSession';

/**
 * Status da chave E2E na sessão atual.
 * Verde na UI = chave ativa (NIP/nome sobem cifrados para a nuvem).
 */
export function useE2eEncryptionStatus(): { e2eActive: boolean; checking: boolean } {
  const { dataOwnerUid, isAuthenticated, user } = useAuth();
  const [e2eActive, setE2eActive] = useState(isE2eKeyActive);
  const [checking, setChecking] = useState(false);

  useEffect(() => subscribeActiveTeamKey(setE2eActive), []);

  useEffect(() => {
    if (!isAuthenticated) {
      setE2eActive(false);
      setChecking(false);
      return;
    }

    if (isE2eKeyActive()) {
      setE2eActive(true);
      setChecking(false);
      return;
    }

    const owner = dataOwnerUid?.trim();
    if (!owner) {
      // Ainda resolvendo owner — não forçar vermelho se a chave já voltar.
      setChecking(true);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void ensureE2eUnlockedForSession(owner, user?.email)
      .then((ok) => {
        if (!cancelled) setE2eActive(ok || isE2eKeyActive());
      })
      .catch(() => {
        if (!cancelled) setE2eActive(isE2eKeyActive());
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataOwnerUid, isAuthenticated, user?.email]);

  return { e2eActive, checking };
}
