/**
 * Escuta postgres_changes do Supabase no banco do dono (owner_uid).
 * Qualquer INSERT/UPDATE/DELETE em tabelas sincronizadas dispara um callback
 * (debounced) para o SyncManager puxar/aplicar via LWW.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../../config/supabase';
import {
  beginRealtimeApply,
  endRealtimeApply,
  setRealtimeListening,
} from '../../services/offline/cloudSyncActivity';
import { syncLogger } from './SyncLogger';

const REALTIME_TABLES = [
  'cadastros',
  'cadastro_rubricas',
  'sessoes',
  'sessao_rubricas',
  'aplicadores',
  'aplicador_senhas',
  'pre_cadastros',
  'authorized_emails',
  'team_wipe',
] as const;

const DEBOUNCE_MS = 400;

type RemoteChangeHandler = () => void;

let channel: RealtimeChannel | null = null;
let activeOwnerUid: string | null = null;
let onRemoteChange: RemoteChangeHandler | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
/** Ignora eco das próprias gravações por alguns segundos após sync local. */
let suppressUntilMs = 0;

function clearDebounce(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function fireRemoteChange(): void {
  if (Date.now() < suppressUntilMs) return;
  if (!onRemoteChange) return;
  beginRealtimeApply();
  try {
    onRemoteChange();
  } finally {
    // O apply real é assíncrono no SyncManager; flag só indica “recebeu evento”.
    endRealtimeApply();
  }
}

function scheduleRemoteChange(): void {
  if (Date.now() < suppressUntilMs) return;
  clearDebounce();
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    fireRemoteChange();
  }, DEBOUNCE_MS);
}

export function suppressRealtimeEcho(ms = 4_000): void {
  suppressUntilMs = Date.now() + Math.max(0, ms);
  clearDebounce();
}

export function stopRealtimeBridge(): void {
  clearDebounce();
  const sb = getSupabase();
  if (channel && sb) {
    void sb.removeChannel(channel);
  }
  channel = null;
  activeOwnerUid = null;
  setRealtimeListening(false);
}

export function startRealtimeBridge(
  ownerUid: string,
  handler: RemoteChangeHandler,
): void {
  const uid = (ownerUid || '').trim();
  if (!uid) {
    stopRealtimeBridge();
    return;
  }

  onRemoteChange = handler;

  if (activeOwnerUid === uid && channel) {
    setRealtimeListening(true);
    return;
  }

  stopRealtimeBridge();
  onRemoteChange = handler;

  const sb = getSupabase();
  if (!sb) {
    setRealtimeListening(false);
    return;
  }

  activeOwnerUid = uid;
  let builder = sb.channel(`taf-owner-${uid}`);

  for (const table of REALTIME_TABLES) {
    builder = builder.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `owner_uid=eq.${uid}`,
      },
      () => {
        scheduleRemoteChange();
      },
    );
  }

  channel = builder.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      setRealtimeListening(true);
      void syncLogger.info('realtime', 'Escuta em tempo real ativa', { ownerUid: uid });
      return;
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      setRealtimeListening(false);
      void syncLogger.warn('realtime', `Canal realtime: ${status}`, { ownerUid: uid });
    }
  });
}

export function isRealtimeBridgeActive(): boolean {
  return channel != null && activeOwnerUid != null;
}
