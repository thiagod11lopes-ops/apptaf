/** Erro interno quando sync é solicitado sem sessão Google ativa. */
export const SYNC_AUTH_REQUIRED = 'AUTH_REQUIRED';

export const SYNC_AUTH_REQUIRED_MESSAGE =
  'Faça login com Google antes de ativar sincronização';

/** Rede local ok, mas a nuvem/Firebase está bloqueada (firewall, proxy, ISP, etc.). */
export const SYNC_UPDATE_BLOCKED = 'UPDATE_BLOCKED';

export const SYNC_UPDATE_BLOCKED_MESSAGE =
  'A atualização com a nuvem foi bloqueada pela rede ou pelo provedor de internet.';
