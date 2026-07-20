import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isSupabaseConfigured, getSupabase } from '../config/supabase';
import { setCloudAuthUser } from '../config/firebase';
import {
  mapSupabaseUser,
  isFirebaseAuthRedirectReturn,
  isPasswordRecoveryCallback,
  clearFirebaseAuthParamsFromWindow,
  parseAuthErrorFromWindow,
  rememberRedirectAuthError,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  requestPasswordReset as requestPasswordResetCloud,
  updateAccountPassword,
  signOutCloud,
  type AppAuthUser,
} from '../services/supabase/emailAuth';
import { hydrateAppStorageFromIndexedDb } from '../offline-first/db/appMeta';
import {
  setAuthUidState,
  waitForAuthenticatedUid,
  getCachedDataOwnerUid,
  getCachedLoginUid,
  enterOfflineStorageSession,
} from '../services/firebase/authUid';
import {
  clearPersistedAuthProfile,
  persistAuthProfile,
  readPersistedAuthProfile,
} from '../services/firebase/authProfile';
import { clearMemoryCloudCache } from '../services/cloudDataCache';
import { syncEngine, notifyDataChanged } from '../offline-first/sync/SyncEngine';
import { syncManager } from '../offline-first/sync/SyncManager';
import { resolveLocalSessionAfterLogin } from '../offline-first/sync/syncSessionPrepare';
import { resolveMemberAccess } from '../offline-first/sync/firebase/FirebaseGateway';
import {
  hasAcceptedNewDatabaseTerms,
  markAcceptedNewDatabaseTerms,
  consumeDatabaseTermsPreAccepted,
} from '../offline-first/auth/databaseTerms';
import { rememberKnownAuthEmailOnDevice } from '../offline-first/auth/knownAuthEmails';
import { ownerHasExistingCloudData } from '../services/supabase/ownerCloudPresence';
import { isCloudOwnerUid } from '../utils/cloudOwnerUid';
import { TermosCriacaoBancoModal } from '../components/auth/TermosCriacaoBancoModal';
import { systemState } from '../offline-first/sync/SystemState';
import { resetCloudSyncStatus } from '../services/offline/cloudSyncActivity';
import { confirmCloudDisplayReady } from '../offline-first/sync/cloudDisplayGate';
import { clearPendingSyncResume } from '../offline-first/sync/syncResume';
import {
  activateE2eFromLoginPassword,
  activateE2eForAuthorizedMember,
  clearE2eSession,
  ensureE2eUnlockedForSession,
  ensureTeamKeyUnlocked,
  E2E_MEMBER_NEEDS_BOOTSTRAP,
  E2E_RECOVERY_NEEDS_UNLOCKED_SESSION_MESSAGE,
  rewrapMemberE2eWithNewPassword,
  rewrapTeamKeyWithNewPassword,
} from '../services/supabase/teamE2eSession';
import { fetchTeamE2eMeta } from '../services/supabase/teamE2eCloud';
import { ensureDatabaseBankCode } from '../services/supabase/databaseRegistryCloud';

type AuthContextType = {
  user: AppAuthUser | null;
  isAuthenticated: boolean;
  authReady: boolean;
  /** true enquanto resolve acesso, migração local e init da sessão após login. */
  isSessionLoading: boolean;
  /** Sessão veio do link de recuperação — pedir nova senha. */
  passwordRecoveryPending: boolean;
  /** @deprecated use supabaseEnabled — mantido para compat de UI. */
  firebaseEnabled: boolean;
  supabaseEnabled: boolean;
  /** UID dono dos dados locais (chefe quando membro autorizado). */
  dataOwnerUid: string | null;
  /** Chefe da conta — pode gerenciar e-mails autorizados e carregar planilha. */
  isBoss: boolean;
  /** Entrou com e-mail autorizado pelo chefe — usa banco do chefe. */
  isAuthorizedMember: boolean;
  signInWithEmail: (
    email: string,
    password: string,
    options?: { bootstrapBossPassword?: string },
  ) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    options?: { bootstrapBossPassword?: string },
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  /**
   * `change` = Conta → Trocar senha (pede senha atual).
   * `recovery` = link do e-mail (não pede senha atual; exige sessão com chave já desbloqueada).
   */
  updatePassword: (
    newPassword: string,
    options?: { mode?: 'change' | 'recovery'; currentPasswordForE2e?: string },
  ) => Promise<void>;
  clearPasswordRecovery: () => void;
  logout: () => Promise<void>;
  /** Atualiza flags chefe/membro a partir do ownerUid persistido localmente. */
  syncLocalSessionFlags: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function restoreE2eForOwner(ownerUid: string, email?: string | null): Promise<void> {
  try {
    await ensureE2eUnlockedForSession(ownerUid, email);
  } catch (error) {
    console.warn('[e2e] restauração da sessão falhou:', error);
  }
}

async function activateE2eWithPassword(
  ownerUid: string,
  password: string,
  options?: { strict?: boolean; createIfMissing?: boolean },
): Promise<void> {
  if (!ownerUid.trim() || !password) return;
  try {
    await activateE2eFromLoginPassword(ownerUid, password, {
      createIfMissing: options?.createIfMissing,
    });
  } catch (error) {
    console.warn('[e2e] ativação com senha de login falhou:', error);
    if (options?.strict) throw error;
  }
}

function isMemberBootstrapNeeded(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === E2E_MEMBER_NEEDS_BOOTSTRAP || code === 'e2e_member_wrap_missing') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('senha de criptografia do chefe') ||
    message.includes('acesso ao banco ainda não foi liberado')
  );
}

function hydrateInitialUser(): AppAuthUser | null {
  return readPersistedAuthProfile();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppAuthUser | null>(hydrateInitialUser);
  const [authReady, setAuthReady] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);
  const [isAuthorizedMember, setIsAuthorizedMember] = useState(false);
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(() => getCachedDataOwnerUid());
  const [termsGate, setTermsGate] = useState<{
    email: string | null;
    resolve: (accepted: boolean) => void;
  } | null>(null);
  const [termsBusy, setTermsBusy] = useState(false);
  const supabaseEnabled = isSupabaseConfigured();
  const firebaseEnabled = supabaseEnabled;
  const authInitializedRef = useRef(false);
  const passwordRecoveryPendingRef = useRef(false);
  /** UID já finalizado nesta sessão (evita re-finalizar em loop com eventos repetidos do Supabase). */
  const finalizedUidRef = useRef<string | null>(null);
  const finalizingRef = useRef(false);
  /** Callers concorrentes (signIn + onAuthStateChange) aguardam a mesma Promise em vez de retornar cedo. */
  const finalizeInFlightRef = useRef<Promise<boolean> | null>(null);
  /** Evita que SIGNED_IN finalize antes do E2E com senha no fluxo e-mail/senha. */
  const emailPasswordAuthInFlightRef = useRef(false);
  const termsGateRef = useRef(termsGate);
  termsGateRef.current = termsGate;

  const setRecoveryPending = useCallback((value: boolean) => {
    passwordRecoveryPendingRef.current = value;
    setPasswordRecoveryPending(value);
  }, []);

  const requestNewDatabaseTermsAcceptance = useCallback((email: string | null): Promise<boolean> => {
    if (termsGateRef.current) {
      return new Promise((resolve) => {
        const previous = termsGateRef.current!;
        setTermsGate({
          email: email ?? previous.email,
          resolve: (accepted) => {
            previous.resolve(accepted);
            resolve(accepted);
          },
        });
      });
    }
    return new Promise((resolve) => {
      setTermsGate({ email, resolve });
    });
  }, []);

  /**
   * Membros autorizados pelo chefe seguem direto.
   * Quem cria/assume o próprio banco precisa aceitar os termos (uma vez por UID).
   */
  const ensureNewDatabaseTermsAccepted = useCallback(
    async (loginUid: string, email: string | null | undefined): Promise<boolean> => {
      const access = await resolveMemberAccess(loginUid, email);
      const isMember =
        access.isAuthorizedMember &&
        isCloudOwnerUid(access.dataOwnerUid) &&
        access.dataOwnerUid !== loginUid;
      if (isMember) return true;
      if (await hasAcceptedNewDatabaseTerms(loginUid)) return true;
      if (await consumeDatabaseTermsPreAccepted(loginUid, email)) return true;
      // Conta que já possui banco na nuvem não é criação — não exibe termos.
      if (await ownerHasExistingCloudData(loginUid)) {
        await markAcceptedNewDatabaseTerms(loginUid);
        return true;
      }
      const accepted = await requestNewDatabaseTermsAcceptance(email?.trim() || null);
      if (!accepted) return false;
      await markAcceptedNewDatabaseTerms(loginUid);
      return true;
    },
    [requestNewDatabaseTermsAcceptance],
  );

  const abortSessionWithoutTerms = useCallback(async () => {
    finalizedUidRef.current = null;
    finalizingRef.current = false;
    setTermsBusy(false);
    const pendingGate = termsGateRef.current;
    if (pendingGate) {
      // Libera quem estiver awaiting ensureNewDatabaseTermsAccepted (evita "Concluindo login…" eterno).
      pendingGate.resolve(false);
      setTermsGate(null);
    }
    setCloudAuthUser(null);
    setUser(null);
    setIsAuthorizedMember(false);
    setIsSessionLoading(false);
    clearE2eSession();
    try {
      await signOutCloud();
    } catch {
      // silencioso — o importante é não concluir a sessão local
    }
  }, []);

  const handleAcceptDatabaseTerms = useCallback(() => {
    const gate = termsGateRef.current;
    if (!gate) return;
    setTermsBusy(true);
    gate.resolve(true);
    setTermsGate(null);
    setTermsBusy(false);
  }, []);

  const handleDeclineDatabaseTerms = useCallback(() => {
    const gate = termsGateRef.current;
    if (!gate) return;
    setTermsBusy(true);
    gate.resolve(false);
    setTermsGate(null);
    setTermsBusy(false);
  }, []);

  const applySignedInAppUserFallback = useCallback(async (mapped: AppAuthUser) => {
    await hydrateAppStorageFromIndexedDb();
    confirmCloudDisplayReady();
    const access = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email).catch(() => null);
    const ownerUid = access?.dataOwnerUid ?? getCachedDataOwnerUid() ?? mapped.uid;
    await restoreE2eForOwner(ownerUid, mapped.email);
    const isMember = access?.isAuthorizedMember ?? ownerUid !== mapped.uid;
    setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
    setUser(mapped);
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(isMember);
    setAuthUidState(mapped.uid, ownerUid, true);
    persistAuthProfile(mapped);
    void rememberKnownAuthEmailOnDevice(mapped.email);
    clearPendingSyncResume();
    setAuthReady(true);
    notifyDataChanged();
    if (supabaseEnabled) {
      await syncManager.bindSession(ownerUid);
      syncManager.setAuthAvailable(true);
      // Diff da nuvem não deve bloquear a entrada no app.
      void syncManager.refreshCloudDiff().catch((err) => {
        console.warn('[auth] refreshCloudDiff (fallback) falhou:', err);
      });
    }
  }, [supabaseEnabled]);

  const finalizeAuthenticatedSession = useCallback(
    async (mapped: AppAuthUser, { force = false }: { force?: boolean } = {}): Promise<boolean> => {
      // signIn e onAuthStateChange disparam juntos — todos aguardam a mesma finalização.
      if (finalizeInFlightRef.current) {
        const ok = await finalizeInFlightRef.current;
        if (!force && finalizedUidRef.current === mapped.uid) return ok;
        if (!force) return ok;
      }
      if (!force && finalizedUidRef.current === mapped.uid) {
        setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
        syncManager.setAuthAvailable(true);
        const owner = getCachedDataOwnerUid() ?? mapped.uid;
        await restoreE2eForOwner(owner, mapped.email);
        return true;
      }

      const run = async (): Promise<boolean> => {
        finalizingRef.current = true;
        finalizedUidRef.current = mapped.uid;
        try {
          // Termos antes do spinner — o modal precisa ficar usável (sem "Concluindo login…" por cima).
          const termsOk = await ensureNewDatabaseTermsAccepted(mapped.uid, mapped.email);
          if (!termsOk) {
            await abortSessionWithoutTerms();
            return false;
          }

          setIsSessionLoading(true);
          await hydrateAppStorageFromIndexedDb();
          confirmCloudDisplayReady();
          const session = await resolveLocalSessionAfterLogin(mapped.uid, mapped.email);
          await restoreE2eForOwner(session.dataOwnerUid, mapped.email);
          setCloudAuthUser({ uid: mapped.uid, email: mapped.email });
          setUser(mapped);
          setDataOwnerUid(session.dataOwnerUid);
          setIsAuthorizedMember(session.isAuthorizedMember);
          setAuthUidState(mapped.uid, session.dataOwnerUid, true);
          persistAuthProfile(mapped);
          void rememberKnownAuthEmailOnDevice(mapped.email);
          clearPendingSyncResume();
          setAuthReady(true);
          notifyDataChanged();

          if (supabaseEnabled) {
            await syncManager.bindSession(session.dataOwnerUid);
            syncManager.setAuthAvailable(true);
            // Estimativa de fila na nuvem é secundária — não segurar a Home.
            void syncManager.refreshCloudDiff().catch((err) => {
              console.warn('[auth] refreshCloudDiff falhou:', err);
            });
            void ensureDatabaseBankCode(session.dataOwnerUid).catch((err) => {
              console.warn('[auth] ensureDatabaseBankCode falhou:', err);
            });
          }
          return true;
        } catch (error) {
          console.warn('[auth] finalizeAuthenticatedSession falhou:', error);
          await applySignedInAppUserFallback(mapped);
          return true;
        } finally {
          finalizingRef.current = false;
          setIsSessionLoading(false);
        }
      };

      const promise = run();
      finalizeInFlightRef.current = promise;
      try {
        return await promise;
      } finally {
        if (finalizeInFlightRef.current === promise) {
          finalizeInFlightRef.current = null;
        }
      }
    },
    [abortSessionWithoutTerms, applySignedInAppUserFallback, ensureNewDatabaseTermsAccepted, supabaseEnabled],
  );

  const finalizeAuthenticatedSessionRef = useRef(finalizeAuthenticatedSession);
  finalizeAuthenticatedSessionRef.current = finalizeAuthenticatedSession;

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      void (async () => {
        await hydrateAppStorageFromIndexedDb();
        const owner = getCachedDataOwnerUid();
        setDataOwnerUid(owner);
        setAuthUidState(null, owner, true);
        setAuthReady(true);
      })();
      return;
    }

    let cancelled = false;

    const applySignedIn = (uid: string, email: string | null, meta?: Record<string, unknown>) => {
      void finalizeAuthenticatedSessionRef.current(
        mapSupabaseUser({ id: uid, email, user_metadata: meta }),
      );
    };

    const applyLocalOfflineSession = (): void => {
      const owner = getCachedDataOwnerUid();
      const profile = readPersistedAuthProfile();
      const loginUid = profile?.uid ?? getCachedLoginUid();
      setUser(profile);
      setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
      setDataOwnerUid(owner);
      setAuthUidState(loginUid, owner, true);
      void systemState.setOfflineMode();
      setAuthReady(true);
    };

    const confirmSignedOut = (): void => {
      void (async () => {
        if (cancelled) return;
        const { data } = await sb.auth.getSession();
        if (data.session?.user) return;
        if (isFirebaseAuthRedirectReturn()) return;
        finalizedUidRef.current = null;
        finalizingRef.current = false;
        finalizeInFlightRef.current = null;
        setIsSessionLoading(false);
        setRecoveryPending(false);

        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        const owner = getCachedDataOwnerUid();
        const profile = readPersistedAuthProfile();
        if (offline && (owner || profile)) {
          setUser(profile);
          const loginUid = profile?.uid ?? getCachedLoginUid();
          setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
          setDataOwnerUid(owner);
          setAuthUidState(loginUid, owner, true);
          void systemState.setOfflineMode();
          setAuthReady(true);
          return;
        }

        applyLocalOfflineSession();
      })();
    };

    void (async () => {
      await hydrateAppStorageFromIndexedDb();
      const owner = getCachedDataOwnerUid();
      setDataOwnerUid(owner);

      const windowError = parseAuthErrorFromWindow();
      if (windowError) {
        rememberRedirectAuthError(windowError);
        clearFirebaseAuthParamsFromWindow();
      }

      const { data } = await sb.auth.getSession();
      authInitializedRef.current = true;
      if (cancelled) return;

      if (data.session?.user) {
        if (isPasswordRecoveryCallback()) {
          setRecoveryPending(true);
          setCloudAuthUser({
            uid: data.session.user.id,
            email: data.session.user.email ?? null,
          });
          setUser(mapSupabaseUser(data.session.user));
          setAuthReady(true);
        } else {
          applySignedIn(
            data.session.user.id,
            data.session.user.email ?? null,
            data.session.user.user_metadata as Record<string, unknown>,
          );
        }
        clearFirebaseAuthParamsFromWindow();
      } else if (isFirebaseAuthRedirectReturn()) {
        setAuthReady(true);
      } else if (owner) {
        const profile = readPersistedAuthProfile();
        const loginUid = profile?.uid ?? getCachedLoginUid();
        setUser(profile);
        setIsAuthorizedMember(Boolean(loginUid && owner && loginUid !== owner));
        setAuthUidState(loginUid, owner, true);
        setAuthReady(true);
        void restoreE2eForOwner(owner, profile?.email ?? null);
        await syncManager.bindSession(owner);
        syncManager.setAuthAvailable(Boolean(data.session?.user));
      } else {
        applyLocalOfflineSession();
      }
    })();

    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryPending(true);
        if (session?.user) {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
          setUser(mapSupabaseUser(session.user));
          setAuthReady(true);
          const owner =
            getCachedDataOwnerUid() ?? session.user.id;
          void restoreE2eForOwner(owner, session.user.email ?? null);
        }
        clearFirebaseAuthParamsFromWindow();
        return;
      }
      if (session?.user) {
        if (passwordRecoveryPendingRef.current && event !== 'USER_UPDATED') {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
          clearFirebaseAuthParamsFromWindow();
          return;
        }
        // Login/cadastro por senha: o fluxo explícito ativa E2E e chama finalize — evita corrida.
        if (emailPasswordAuthInFlightRef.current && event === 'SIGNED_IN') {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
          clearFirebaseAuthParamsFromWindow();
          return;
        }
        if (event !== 'TOKEN_REFRESHED') {
          applySignedIn(
            session.user.id,
            session.user.email ?? null,
            session.user.user_metadata as Record<string, unknown>,
          );
        } else {
          setCloudAuthUser({ uid: session.user.id, email: session.user.email ?? null });
        }
        clearFirebaseAuthParamsFromWindow();
        return;
      }
      if (!authInitializedRef.current || isFirebaseAuthRedirectReturn()) return;
      if (event === 'SIGNED_OUT') confirmSignedOut();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string, options?: { bootstrapBossPassword?: string }) => {
      if (!supabaseEnabled) {
        throw new Error(
          'Configure o Supabase no arquivo .env (veja .env.example) antes de entrar.',
        );
      }
      emailPasswordAuthInFlightRef.current = true;
      try {
        const signedIn = await signInWithEmailPassword(email, password);
        setRecoveryPending(false);

        // Consulta a nuvem: e-mail autorizado → banco do chefe; senão → banco próprio.
        const access = await resolveMemberAccess(signedIn.uid, signedIn.email);
        const isMember =
          access.isAuthorizedMember &&
          isCloudOwnerUid(access.dataOwnerUid) &&
          access.dataOwnerUid !== signedIn.uid;
        const ownerUid = isMember ? access.dataOwnerUid : signedIn.uid;

        if (isMember) {
          try {
            await activateE2eForAuthorizedMember(ownerUid, signedIn.email ?? email, password, {
              bootstrapBossPassword: options?.bootstrapBossPassword,
            });
          } catch (error) {
            if (isMemberBootstrapNeeded(error) && !options?.bootstrapBossPassword) {
              throw error;
            }
            throw error;
          }
        } else {
          await activateE2eWithPassword(ownerUid, password, {
            strict: true,
            createIfMissing: true,
          });
        }

        const ok = await finalizeAuthenticatedSession(signedIn);
        if (!ok) {
          throw new Error('É necessário aceitar os termos para criar um novo banco de dados.');
        }
        await waitForAuthenticatedUid(20_000);
        if (supabaseEnabled) {
          void syncManager.tryBackgroundSync().catch((err) => {
            console.warn('[auth] sync pós-login:', err);
          });
        }
      } finally {
        emailPasswordAuthInFlightRef.current = false;
      }
    },
    [finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, options?: { bootstrapBossPassword?: string }) => {
      if (!supabaseEnabled) {
        throw new Error(
          'Configure o Supabase no arquivo .env (veja .env.example) antes de criar conta.',
        );
      }
      emailPasswordAuthInFlightRef.current = true;
      try {
        const result = await signUpWithEmailPassword(email, password);
        if (result.user && !result.needsEmailConfirmation) {
          setRecoveryPending(false);
          const access = await resolveMemberAccess(result.user.uid, result.user.email);
          const isMember =
            access.isAuthorizedMember &&
            isCloudOwnerUid(access.dataOwnerUid) &&
            access.dataOwnerUid !== result.user.uid;
          const ownerUid = isMember ? access.dataOwnerUid : result.user.uid;
          if (isMember) {
            await activateE2eForAuthorizedMember(
              ownerUid,
              result.user.email ?? email,
              password,
              { bootstrapBossPassword: options?.bootstrapBossPassword },
            );
          } else {
            await activateE2eWithPassword(ownerUid, password, {
              strict: true,
              createIfMissing: true,
            });
          }
          const ok = await finalizeAuthenticatedSession(result.user);
          if (!ok) {
            throw new Error('É necessário aceitar os termos para criar um novo banco de dados.');
          }
          await waitForAuthenticatedUid(20_000);
          if (supabaseEnabled) {
            void syncManager.tryBackgroundSync().catch((err) => {
              console.warn('[auth] sync pós-cadastro:', err);
            });
          }
        }
        return { needsEmailConfirmation: result.needsEmailConfirmation };
      } finally {
        emailPasswordAuthInFlightRef.current = false;
      }
    },
    [finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled],
  );

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!supabaseEnabled) {
        throw new Error('Configure o Supabase no arquivo .env antes de recuperar a senha.');
      }
      await requestPasswordResetCloud(email);
    },
    [supabaseEnabled],
  );

  const updatePassword = useCallback(
    async (
      newPassword: string,
      options?: { mode?: 'change' | 'recovery'; currentPasswordForE2e?: string },
    ) => {
      if (!supabaseEnabled) {
        throw new Error('Configure o Supabase no arquivo .env.');
      }

      const mode = options?.mode ?? (passwordRecoveryPendingRef.current ? 'recovery' : 'change');
      const loginUid = getCachedLoginUid() ?? user?.uid ?? null;
      // Na recuperação o cache pode estar parcial — chefe = loginUid dono dos dados.
      const ownerUid = getCachedDataOwnerUid() ?? dataOwnerUid ?? loginUid;
      const isBossAccount = Boolean(loginUid && ownerUid && loginUid === ownerUid);
      const currentPasswordForE2e = options?.currentPasswordForE2e?.trim() ?? '';

      // Chefe: reembrulha team_e2e_meta. Membro: reembrulha wrap próprio.
      let mustRewrapBossE2e = false;
      let mustRewrapMemberE2e = false;
      const memberEmail = user?.email?.trim() || '';

      if (isBossAccount && ownerUid) {
        let meta: Awaited<ReturnType<typeof fetchTeamE2eMeta>> = null;
        try {
          meta = await fetchTeamE2eMeta(ownerUid);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Não foi possível verificar a criptografia da equipe antes de trocar a senha: ${detail}`,
          );
        }
        if (meta) {
          if (mode === 'change') {
            if (!currentPasswordForE2e) {
              throw new Error('Informe a senha atual para trocar a senha com criptografia ativa.');
            }
            try {
              await activateE2eFromLoginPassword(ownerUid, currentPasswordForE2e);
            } catch {
              throw new Error(
                'Senha atual incorreta ou não desbloqueia a criptografia. Confira e tente de novo.',
              );
            }
          } else {
            try {
              await ensureTeamKeyUnlocked(ownerUid);
            } catch {
              throw new Error(E2E_RECOVERY_NEEDS_UNLOCKED_SESSION_MESSAGE);
            }
          }
          await ensureTeamKeyUnlocked(ownerUid);
          mustRewrapBossE2e = true;
        }
      } else if (ownerUid && loginUid && ownerUid !== loginUid && memberEmail) {
        if (mode === 'change') {
          if (!currentPasswordForE2e) {
            throw new Error('Informe a senha atual para trocar a senha com criptografia ativa.');
          }
          try {
            await activateE2eForAuthorizedMember(ownerUid, memberEmail, currentPasswordForE2e);
          } catch {
            throw new Error(
              'Senha atual incorreta ou não desbloqueia a criptografia. Confira e tente de novo.',
            );
          }
        } else {
          try {
            await ensureTeamKeyUnlocked(ownerUid);
          } catch {
            throw new Error(E2E_RECOVERY_NEEDS_UNLOCKED_SESSION_MESSAGE);
          }
        }
        mustRewrapMemberE2e = true;
      }

      await updateAccountPassword(newPassword);

      if (mustRewrapBossE2e && ownerUid) {
        try {
          await rewrapTeamKeyWithNewPassword(ownerUid, newPassword);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Senha da conta atualizada, mas falhou ao reproteger a criptografia: ${detail}. ` +
              'Permaneça logado (escudo verde) e tente Conta → Trocar senha.',
          );
        }
      }
      if (mustRewrapMemberE2e && ownerUid && memberEmail) {
        try {
          await rewrapMemberE2eWithNewPassword(ownerUid, memberEmail, newPassword);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `Senha da conta atualizada, mas falhou ao reproteger seu acesso ao banco: ${detail}. ` +
              'Permaneça logado e tente Conta → Trocar senha.',
          );
        }
      }

      setRecoveryPending(false);
      const sb = getSupabase();
      const { data } = await sb!.auth.getSession();
      if (data.session?.user) {
        await finalizeAuthenticatedSession(mapSupabaseUser(data.session.user), { force: true });
      }
    },
    [dataOwnerUid, finalizeAuthenticatedSession, setRecoveryPending, supabaseEnabled, user?.uid],
  );

  const clearPasswordRecovery = useCallback(() => {
    setRecoveryPending(false);
  }, [setRecoveryPending]);

  const syncLocalSessionFlags = useCallback(() => {
    const loginUid = getCachedLoginUid();
    const ownerUid = getCachedDataOwnerUid();
    if (!loginUid || !ownerUid) return;
    setDataOwnerUid(ownerUid);
    setIsAuthorizedMember(ownerUid !== loginUid);
  }, []);

  const logout = useCallback(async () => {
    const ownerBeforeLogout = getCachedDataOwnerUid();
    finalizedUidRef.current = null;
    finalizingRef.current = false;
    finalizeInFlightRef.current = null;
    clearE2eSession();
    await signOutCloud();
    setCloudAuthUser(null);
    setUser(null);
    setRecoveryPending(false);
    setIsAuthorizedMember(false);
    clearPersistedAuthProfile();
    clearMemoryCloudCache();
    resetCloudSyncStatus();
    confirmCloudDisplayReady();
    syncEngine.shutdown();
    await syncManager.shutdown();
    await systemState.setOfflineMode();
    await enterOfflineStorageSession();
    setDataOwnerUid(ownerBeforeLogout ?? getCachedDataOwnerUid());
    notifyDataChanged();
  }, []);

  const isBoss = user != null && !isAuthorizedMember;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: user != null,
      authReady,
      isSessionLoading,
      passwordRecoveryPending,
      firebaseEnabled,
      supabaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      logout,
      syncLocalSessionFlags,
    }),
    [
      user,
      authReady,
      isSessionLoading,
      passwordRecoveryPending,
      firebaseEnabled,
      supabaseEnabled,
      dataOwnerUid,
      isBoss,
      isAuthorizedMember,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      updatePassword,
      clearPasswordRecovery,
      logout,
      syncLocalSessionFlags,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <TermosCriacaoBancoModal
        visible={termsGate != null}
        email={termsGate?.email}
        loading={termsBusy}
        onAccept={handleAcceptDatabaseTerms}
        onDecline={handleDeclineDatabaseTerms}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return ctx;
}

export type { AppAuthUser };
