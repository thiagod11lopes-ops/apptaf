/**
 * Escuta em tempo real de reservas/slots de agendamento.
 * Independente da chave BNC / RealtimeBridge — só precisa de sessão Supabase.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '../config/supabase';

const DEBOUNCE_MS = 500;
/** Fallback se a publication realtime ainda não incluir as tabelas. */
const POLL_MS = 8_000;

/**
 * Assina mudanças em `agendamento_reservas` e `agendamento_slots`.
 * Retorna função de cleanup.
 */
export function subscribeAgendamentoVagasRealtime(
  onChange: () => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let channel: RealtimeChannel | null = null;
  let disposed = false;

  const schedule = () => {
    if (disposed) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      if (!disposed) onChange();
    }, DEBOUNCE_MS);
  };

  const sb = getSupabase();
  if (sb) {
    channel = sb
      .channel(`agendamento-vagas-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamento_reservas' },
        () => schedule(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamento_slots' },
        () => schedule(),
      )
      .subscribe();
  }

  // Polling leve: cobre atraso do Realtime e ambientes sem publication.
  const pollId = setInterval(schedule, POLL_MS);

  return () => {
    disposed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
    clearInterval(pollId);
    if (channel && sb) {
      void sb.removeChannel(channel);
    }
    channel = null;
  };
}
