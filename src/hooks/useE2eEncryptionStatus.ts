import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { isE2eKeyActive, subscribeActiveTeamKey } from '../services/supabase/e2eCrypto';
import {
  ensureE2eUnlockedForSession,
  isE2eSessionTrusted,
} from '../services/supabase/teamE2eSession';
import { fetchTeamE2eMemberWrap } from '../services/supabase/teamE2eMemberWrapsCloud';
import { isAuthorizedMemberSession } from '../utils/aplicadorSyncPolicy';
import {
  getE2eUiStatusCopy,
  isE2eUiReady,
  resolveE2eUiStatus,
  type E2eUiStatus,
} from '../offline-first/sync/e2eUiStatus';

export type E2eEncryptionStatusState = {
  /** Compat: true só quando status === 'ready' (verde verdadeiro). */
  e2eActive: boolean;
  status: E2eUiStatus;
  checking: boolean;
  copy: ReturnType<typeof getE2eUiStatusCopy>;
};

function computeStatus(memberWrapPresent: boolean | null): E2eUiStatus {
  return resolveE2eUiStatus({
    isAuthorizedMember: isAuthorizedMemberSession(),
    hasActiveKey: isE2eKeyActive(),
    sessionTrusted: isE2eSessionTrusted(),
    memberWrapPresent,
  });
}

/**
 * Status da chave E2E na sessão atual.
 * Verde = ready (chave ativa e confiável). Âmbar = aguardando chefe / desatualizada.
 */
export function useE2eEncryptionStatus(): E2eEncryptionStatusState {
  const { dataOwnerUid, isAuthenticated, user } = useAuth();
  const [memberWrapPresent, setMemberWrapPresent] = useState<boolean | null>(null);
  const [status, setStatus] = useState<E2eUiStatus>(() => computeStatus(null));
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    return subscribeActiveTeamKey(() => {
      setStatus(computeStatus(memberWrapPresent));
    });
  }, [memberWrapPresent]);

  useEffect(() => {
    if (!isAuthenticated) {
      setMemberWrapPresent(null);
      setStatus('inactive');
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    void (async () => {
      const owner = dataOwnerUid?.trim();
      if (!owner) return;

      try {
        if (!isE2eKeyActive()) {
          await ensureE2eUnlockedForSession(owner, user?.email);
        }

        let wrapKnown: boolean | null = null;
        const needsWrapProbe =
          isAuthorizedMemberSession() && !isE2eKeyActive() && !isE2eSessionTrusted();

        if (needsWrapProbe && user?.email?.trim()) {
          try {
            const wrap = await fetchTeamE2eMemberWrap(owner, user.email);
            wrapKnown = Boolean(wrap);
          } catch {
            wrapKnown = null;
          }
        }

        if (cancelled) return;
        setMemberWrapPresent(wrapKnown);
        setStatus(computeStatus(wrapKnown));
      } catch {
        if (!cancelled) setStatus(computeStatus(memberWrapPresent));
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dataOwnerUid, isAuthenticated, user?.email]);

  useEffect(() => {
    setStatus(computeStatus(memberWrapPresent));
  }, [memberWrapPresent]);

  return {
    e2eActive: isE2eUiReady(status),
    status,
    checking,
    copy: getE2eUiStatusCopy(status),
  };
}
