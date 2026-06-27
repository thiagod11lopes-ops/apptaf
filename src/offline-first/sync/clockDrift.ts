import { estimateServerTimeMs } from './firebase/FirebaseGateway';

export type ClockDriftResult = {
  localTimeMs: number;
  serverTimeMs: number | null;
  driftMs: number;
  warning: boolean;
  warningMessage: string | null;
};

const DRIFT_THRESHOLD_MS = 2 * 60 * 1000;

export async function detectClockDrift(): Promise<ClockDriftResult> {
  const localBefore = Date.now();
  const serverTimeMs = await estimateServerTimeMs();
  const localAfter = Date.now();
  const localMid = Math.round((localBefore + localAfter) / 2);

  if (serverTimeMs == null) {
    return {
      localTimeMs: localMid,
      serverTimeMs: null,
      driftMs: 0,
      warning: false,
      warningMessage: null,
    };
  }

  const driftMs = localMid - serverTimeMs;
  const warning = Math.abs(driftMs) > DRIFT_THRESHOLD_MS;

  return {
    localTimeMs: localMid,
    serverTimeMs,
    driftMs,
    warning,
    warningMessage: warning
      ? 'O relógio deste computador está diferente do horário do servidor. Isso pode afetar a sincronização.'
      : null,
  };
}
