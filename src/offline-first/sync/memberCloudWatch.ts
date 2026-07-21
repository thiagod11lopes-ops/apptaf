/**
 * Poll do membro autorizado + política de pull após Realtime.
 * Extraído do SyncManager (dose 4) para reduzir monólito e travar regressões.
 */
import { getConnectivityState } from './ConnectivityMonitor';
import { invalidateRemoteSnapshotCache } from './remoteSnapshotCache';
import { forceNextFullRemoteFetch } from './syncWatermark';
import { isAuthorizedMemberSession } from '../../utils/aplicadorSyncPolicy';
import { getCachedLoginUid } from '../../services/firebase/authUid';
import { applyTeamWipeIfNeeded } from './syncTeamWipe';

/** Após evento realtime remoto — coalesce lotes (CSV) antes do pull. */
export const REALTIME_PULL_DEBOUNCE_MS = 2_000;
/** Membro autorizado: varredura periódica (rede lenta / Realtime falhou). */
export const MEMBER_CLOUD_POLL_MS = 8_000;
/** A cada N ticks do poll do membro: força full fetch (~96s). */
export const MEMBER_FULL_FETCH_EVERY_TICKS = 12;

/** Chefe força full no Realtime; membro não (evita loop em CSV). */
export function shouldForceFullFetchOnRealtimeEvent(isAuthorizedMember: boolean): boolean {
  return !isAuthorizedMember;
}

/** Full fetch periódico no poll do membro. */
export function shouldForceFullFetchOnMemberPollTick(
  tick: number,
  everyTicks: number = MEMBER_FULL_FETCH_EVERY_TICKS,
): boolean {
  return tick > 0 && tick % everyTicks === 0;
}

export type MemberCloudPollHost = {
  isAuthAvailable: () => boolean;
  isSyncBusy: () => boolean;
  getOwnerUid: () => string | null | undefined;
  requestForcePull: () => void;
  clearBackgroundCooldown: () => void;
  scheduleBackgroundSync: (delayMs: number) => void;
};

let memberCloudPollTimer: ReturnType<typeof setInterval> | null = null;
let memberCloudPollTick = 0;

export function stopMemberCloudPoll(): void {
  if (memberCloudPollTimer) {
    clearInterval(memberCloudPollTimer);
    memberCloudPollTimer = null;
  }
  memberCloudPollTick = 0;
}

/**
 * No e-mail autorizado, varre a nuvem periodicamente — cobre Realtime atrasado
 * ou rede instável sem depender só do evento postgres_changes.
 */
export function startMemberCloudPoll(host: MemberCloudPollHost): void {
  stopMemberCloudPoll();
  if (!host.isAuthAvailable() || !isAuthorizedMemberSession()) return;

  memberCloudPollTimer = setInterval(() => {
    if (!host.isAuthAvailable() || host.isSyncBusy()) return;
    if (getConnectivityState() !== 'ONLINE') return;
    if (!isAuthorizedMemberSession()) return;

    memberCloudPollTick += 1;
    const tick = memberCloudPollTick;
    void (async () => {
      const uid = host.getOwnerUid()?.trim();
      if (!uid) return;
      host.requestForcePull();
      host.clearBackgroundCooldown();
      if (shouldForceFullFetchOnMemberPollTick(tick)) {
        invalidateRemoteSnapshotCache();
        try {
          await forceNextFullRemoteFetch(uid);
        } catch {
          // segue
        }
      }
      host.scheduleBackgroundSync(0);
    })();
  }, MEMBER_CLOUD_POLL_MS);
}

export type RealtimePullHost = {
  isAuthAvailable: () => boolean;
  getOwnerUid: () => string | null | undefined;
  /** Chamado após wipe remoto aplicado (ex.: zerar mirrorDone). */
  onTeamWiped?: () => void | Promise<void>;
  requestForcePull: () => void;
  clearBackgroundCooldown: () => void;
  refreshQueueEstimate: () => void;
  scheduleBackgroundSync: (delayMs: number) => void;
  logWipeError?: (detail: string) => void | Promise<void>;
};

/** Handler de mudança remota (após debounce do RealtimeBridge). */
export function handleRealtimeRemoteChange(host: RealtimePullHost): void {
  if (!host.isAuthAvailable()) return;

  void (async () => {
    const uid = host.getOwnerUid()?.trim();
    if (uid) {
      try {
        const wiped = await applyTeamWipeIfNeeded(uid, getCachedLoginUid());
        if (wiped) {
          await host.onTeamWiped?.();
        }
      } catch (error) {
        await host.logWipeError?.(
          `applyTeamWipeIfNeeded falhou: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      // Full fetch a cada linha do CSV no membro gerava snapshots incompletos.
      invalidateRemoteSnapshotCache();
      if (shouldForceFullFetchOnRealtimeEvent(isAuthorizedMemberSession())) {
        try {
          await forceNextFullRemoteFetch(uid);
        } catch {
          // segue o pull
        }
      }
    }
    host.requestForcePull();
    host.clearBackgroundCooldown();
    host.refreshQueueEstimate();
    host.scheduleBackgroundSync(REALTIME_PULL_DEBOUNCE_MS);
  })();
}

/** Exposto para testes. */
export function __getMemberCloudPollTickForTests(): number {
  return memberCloudPollTick;
}
