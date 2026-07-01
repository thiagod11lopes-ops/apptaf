import { SYNC_AUTH_REQUIRED, SYNC_AUTH_REQUIRED_MESSAGE } from './syncAuthMessages';

export type SyncErrorDetail = {
  /** Identificador curto (ex.: network_offline, auth_required). */
  code: string;
  /** Categoria legível para o usuário. */
  typeLabel: string;
  /** Descrição do que aconteceu. */
  message: string;
  /** Sugestão prática para tentar resolver. */
  hint: string;
};

const GENERIC: SyncErrorDetail = {
  code: 'sync_failed',
  typeLabel: 'Falha na sincronização',
  message: 'Falha ao sincronizar com a nuvem. Tente novamente.',
  hint: 'Toque em «Tentar novamente». Se persistir, saia e entre com Google.',
};

function detail(
  code: string,
  typeLabel: string,
  message: string,
  hint: string,
): SyncErrorDetail {
  return { code, typeLabel, message, hint };
}

/** Classifica erro bruto da sincronização para exibição na UI. */
export function parseSyncError(raw?: string | null): SyncErrorDetail {
  if (!raw?.trim()) return { ...GENERIC };

  const msg = raw.trim();

  if (msg === 'offline') {
    return detail(
      'network_offline',
      'Sem conexão',
      'Sem conexão com a internet.',
      'Verifique Wi‑Fi ou dados móveis e tente novamente.',
    );
  }

  if (msg === 'sync_in_progress') {
    return detail(
      'sync_in_progress',
      'Sincronização em andamento',
      'Já existe uma sincronização em curso.',
      'Aguarde a conclusão antes de tentar de novo.',
    );
  }

  if (msg === 'no_owner') {
    return detail(
      'auth_session',
      'Sessão inválida',
      'Sessão inválida ou usuário não identificado.',
      'Saia da conta e entre novamente com Google.',
    );
  }

  if (
    msg === SYNC_AUTH_REQUIRED ||
    msg === SYNC_AUTH_REQUIRED_MESSAGE ||
    msg === 'Faça login com Google para sincronizar.' ||
    /sess[aã]o google n[aã]o encontrada/i.test(msg)
  ) {
    return detail(
      'auth_required',
      'Login necessário',
      SYNC_AUTH_REQUIRED_MESSAGE,
      'Abra Configurações ou Início e faça login com Google.',
    );
  }

  if (/token.*expirad|sess[aã]o expirada|entre novamente com google/i.test(msg)) {
    return detail(
      'auth_expired',
      'Sessão expirada',
      msg,
      'Saia da conta e entre novamente com Google.',
    );
  }

  if (msg === 'upload_failed' || msg === 'upload_incomplete') {
    return detail(
      'upload_failed',
      'Falha ao enviar',
      'Não foi possível enviar os dados locais para a nuvem.',
      'Confirme login e conexão; depois toque em «Tentar novamente».',
    );
  }

  if (msg === 'pending_remain' || /^pending_remain:\d+/.test(msg)) {
    const count = msg.includes(':') ? msg.split(':')[1] ?? '0' : 'algumas';
    return detail(
      'upload_incomplete',
      'Envio incompleto',
      `${count} alteração(ões) local(is) não foram sincronizadas.`,
      'Verifique login e permissões; tente sincronizar outra vez.',
    );
  }

  if (/firestore indispon/i.test(msg) || /n[aã]o foi poss[ií]vel conectar ao firebase/i.test(msg)) {
    return detail(
      'firebase_unavailable',
      'Firebase indisponível',
      msg,
      'Verifique a internet e se o Firebase está acessível; tente mais tarde.',
    );
  }

  if (/permission|permiss[aã]o|denied|insufficient|negada/i.test(msg)) {
    const message =
      /pre_cadastros|Publique as regras|Permissão negada/i.test(msg)
        ? msg
        : 'Permissão negada na nuvem (Firestore).';
    return detail(
      'permission_denied',
      'Permissão na nuvem',
      message,
      'Confirme que sua conta está autorizada e que as regras do Firebase permitem leitura/escrita.',
    );
  }

  if (/^[a-z_]+\/[^:]+:/i.test(msg)) {
    const [, rest] = msg.match(/^[^:]+:\s*(.*)$/s) ?? [null, msg];
    const inner = parseSyncError(rest ?? msg);
    return {
      ...inner,
      message: msg,
      hint: inner.hint,
    };
  }

  return detail('sync_failed', 'Erro na sincronização', msg, GENERIC.hint);
}

export function formatSyncUploadError(raw?: string | null): string {
  return parseSyncError(raw).message;
}
