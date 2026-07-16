/** Erro interno quando sync é solicitado sem sessão autenticada. */
export const SYNC_AUTH_REQUIRED = 'AUTH_REQUIRED';

export const SYNC_AUTH_REQUIRED_MESSAGE =
  'Faça login com e-mail e senha antes de ativar a sincronização';

/** Rede local ok, mas a nuvem está bloqueada (firewall, proxy, ISP, etc.). */
export const SYNC_UPDATE_BLOCKED = 'UPDATE_BLOCKED';

export const SYNC_UPDATE_BLOCKED_MESSAGE =
  'A atualização com a nuvem foi bloqueada pela rede ou pelo provedor de internet.';

export const DEMO_SYNC_BLOCKED_MESSAGE =
  'Modo demonstração ativo — os dados de exemplo ficam apenas no dispositivo e não são enviados à nuvem.';
