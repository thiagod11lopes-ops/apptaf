import {
  SYNC_AUTH_REQUIRED,
  SYNC_AUTH_REQUIRED_MESSAGE,
  SYNC_UPDATE_BLOCKED,
  SYNC_UPDATE_BLOCKED_MESSAGE,
} from './syncAuthMessages';
import {
  E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE,
  E2E_KEY_REQUIRED_MESSAGE,
} from '../../services/supabase/teamE2eSession';

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
  hint: 'Toque em «Tentar novamente». Se persistir, saia e entre novamente.',
};

function detail(
  code: string,
  typeLabel: string,
  message: string,
  hint: string,
): SyncErrorDetail {
  return { code, typeLabel, message, hint };
}

const UPDATE_BLOCKED_HINT =
  'Tente outra rede (ex.: dados móveis) ou VPN. Se persistir, verifique se o Supabase está acessível.';

/** Indica bloqueio de acesso à nuvem (rede/proxy/firewall), não falta de internet local. */
export function shouldTreatAsUpdateBlocked(raw?: string | null): boolean {
  if (!raw?.trim()) return false;
  const msg = raw.trim();
  if (msg === SYNC_UPDATE_BLOCKED || msg === SYNC_UPDATE_BLOCKED_MESSAGE) return true;
  if (
    /permission|permiss[aã]o|denied|insufficient|negada|token.*expirad|sess[aã]o google|AUTH_REQUIRED/i.test(
      msg,
    )
  ) {
    return false;
  }
  return (
    /failed to fetch|network request failed|load failed|err_blocked|blocked by|cors|firestore\.googleapis|googleapis\.com|sem conex[aã]o com o firebase|n[aã]o foi poss[ií]vel conectar ao firebase|could not reach|net::err|access control|proxy|firewall/i.test(
      msg,
    )
  );
}

function updateBlockedDetail(message = SYNC_UPDATE_BLOCKED_MESSAGE): SyncErrorDetail {
  return detail('update_blocked', 'Atualização bloqueada', message, UPDATE_BLOCKED_HINT);
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

  if (msg === SYNC_UPDATE_BLOCKED || shouldTreatAsUpdateBlocked(msg)) {
    return updateBlockedDetail(SYNC_UPDATE_BLOCKED_MESSAGE);
  }

  if (
    msg === E2E_KEY_REQUIRED_MESSAGE ||
    msg.startsWith(E2E_KEY_REQUIRED_MESSAGE)
  ) {
    return detail(
      'e2e_key_required',
      'Criptografia necessária',
      msg,
      'Saia da conta (Conta → Sair) e entre de novo com e-mail e senha; depois sincronize.',
    );
  }

  if (/E2E_KEY_MISMATCH/i.test(msg)) {
    return detail(
      'e2e_key_mismatch',
      'Chave diferente entre aparelhos',
      msg.replace(/^E2E_KEY_MISMATCH:\s*/i, '').trim() ||
        'A chave deste aparelho não abre os dados da nuvem do mesmo BNC.',
      'Nos dois aparelhos: Conta → Sair → entre com o mesmo e-mail e senha. Depois sincronize no aparelho que tem os dados e, em seguida, no outro.',
    );
  }

  if (msg === E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE) {
    return detail(
      'e2e_not_activated',
      'Criptografia não ativada',
      E2E_ENCRYPTION_NOT_ACTIVATED_MESSAGE,
      'Saia e entre com e-mail e senha para criar a chave da equipe na primeira vez.',
    );
  }

  if (/Criptografia E2E obrigatória/i.test(msg)) {
    return detail(
      'e2e_encrypt_required',
      'Criptografia necessária',
      msg,
      'Saia da conta e entre novamente com e-mail e senha antes de sincronizar.',
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
      'Saia da conta e entre novamente com e-mail e senha.',
    );
  }

  if (/invalid input syntax for type uuid|UID legado do Firebase|UID inválido na nuvem/i.test(msg)) {
    return detail(
      'legacy_firebase_uid',
      'UID legado do Firebase',
      msg,
      'Saia e entre novamente com e-mail/senha. Se persistir, exclua os dados locais e reimporte o CSV.',
    );
  }

  if (
    msg === SYNC_AUTH_REQUIRED ||
    msg === SYNC_AUTH_REQUIRED_MESSAGE ||
    msg === 'Faça login com Google para sincronizar.' ||
    /sess[aã]o google n[aã]o encontrada/i.test(msg) ||
    /sess[aã]o n[aã]o encontrada/i.test(msg)
  ) {
    return detail(
      'auth_required',
      'Login necessário',
      SYNC_AUTH_REQUIRED_MESSAGE,
      'Abra Conta e entre com e-mail e senha (@marinha.mil.br).',
    );
  }

  if (/token.*expirad|sess[aã]o expirada|entre novamente/i.test(msg)) {
    return detail(
      'auth_expired',
      'Sessão expirada',
      msg,
      'Saia da conta e entre novamente com e-mail e senha.',
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

  if (
    /firestore indispon/i.test(msg) ||
    /n[aã]o foi poss[ií]vel conectar ao (firebase|supabase)/i.test(msg) ||
    /supabase indispon/i.test(msg)
  ) {
    return detail(
      'cloud_unavailable',
      'Nuvem indisponível',
      msg,
      'Verifique a internet e se o Supabase está acessível; tente mais tarde.',
    );
  }

  if (/permission|permiss[aã]o|denied|insufficient|negada|row-level security|rls|policy/i.test(msg)) {
    const message =
      /Permissão negada/i.test(msg)
        ? msg.replace(/\(Firestore\)/gi, '').replace(/Firebase/gi, 'Supabase').trim()
        : 'Permissão negada na nuvem (Supabase).';
    return detail(
      'permission_denied',
      'Permissão na nuvem',
      message,
      'Confirme que entrou com @marinha.mil.br e que o schema/policies do Supabase foram aplicados.',
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
