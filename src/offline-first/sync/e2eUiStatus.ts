/**
 * Status E2E para UI (escudo / modal).
 * Distingue verde verdadeiro de “chave local mas não confiável” e “aguardando chefe”.
 */

export type E2eUiStatus =
  | 'ready'
  | 'awaiting_boss_wrap'
  | 'key_mismatch'
  | 'inactive';

export type ResolveE2eUiStatusInput = {
  isAuthorizedMember: boolean;
  hasActiveKey: boolean;
  sessionTrusted: boolean;
  /**
   * Só relevante para membro sem chave:
   * - null = ainda não consultou wrap
   * - false = sem wrap na nuvem
   * - true = wrap existe
   */
  memberWrapPresent: boolean | null;
};

/** Decide o estado do escudo sem I/O. */
export function resolveE2eUiStatus(input: ResolveE2eUiStatusInput): E2eUiStatus {
  const { isAuthorizedMember, hasActiveKey, sessionTrusted, memberWrapPresent } = input;

  if (hasActiveKey && sessionTrusted) return 'ready';
  if (hasActiveKey && !sessionTrusted) return 'key_mismatch';

  if (isAuthorizedMember && memberWrapPresent === false) {
    return 'awaiting_boss_wrap';
  }

  return 'inactive';
}

/** Verde na UI só quando E2E está confiável (não só “tem chave na RAM”). */
export function isE2eUiReady(status: E2eUiStatus): boolean {
  return status === 'ready';
}

export type E2eUiStatusCopy = {
  chip: string;
  tooltipTitle: string;
  tooltipDescription: string;
  body: string[];
  footnote: string;
};

export function getE2eUiStatusCopy(status: E2eUiStatus): E2eUiStatusCopy {
  switch (status) {
    case 'ready':
      return {
        chip: 'Criptografia ativa',
        tooltipTitle: 'Criptografia ativa',
        tooltipDescription: 'NIP e nome vão cifrados para a nuvem. Toque para detalhes.',
        body: [
          'A chave da equipe está desbloqueada e confiável nesta sessão. Online, o NIP e o nome dos militares vão cifrados (AES-GCM) para a nuvem — quem olhar o banco remoto não lê esses dados sem a chave.',
          'Sem internet, o app usa o cache local do aparelho para continuar funcionando.',
        ],
        footnote:
          'Verde = E2E confiável · Âmbar = aguardando/desatualizado · Vermelho = inativo',
      };
    case 'awaiting_boss_wrap':
      return {
        chip: 'Aguardando chave do chefe',
        tooltipTitle: 'Aguardando chave do chefe',
        tooltipDescription:
          'Seu e-mail está autorizado, mas o chefe ainda não liberou o acesso cifrado.',
        body: [
          'Seu e-mail está na lista de autorizados, porém a chave cifrada da equipe ainda não foi liberada para você.',
          'Peça ao chefe (escudo verde) para sincronizar ou marcar de novo seu e-mail em Configurações → e-mails autorizados. Depois, saia e entre novamente neste aparelho.',
        ],
        footnote:
          'Verde = E2E confiável · Âmbar = aguardando/desatualizado · Vermelho = inativo',
      };
    case 'key_mismatch':
      return {
        chip: 'Chave desatualizada',
        tooltipTitle: 'Chave desatualizada',
        tooltipDescription:
          'Há chave neste aparelho, mas ela não está alinhada com a nuvem.',
        body: [
          'Este aparelho tem uma chave local, mas ela não é confiável para abrir os dados atuais da nuvem (wrap antigo ou sessão restaurada sem senha).',
          'Peça ao chefe (escudo verde) para renovar seu acesso no checklist de e-mails autorizados; depois saia e entre de novo com e-mail e senha.',
        ],
        footnote:
          'Verde = E2E confiável · Âmbar = aguardando/desatualizado · Vermelho = inativo',
      };
    case 'inactive':
    default:
      return {
        chip: 'Criptografia inativa',
        tooltipTitle: 'Criptografia inativa',
        tooltipDescription: 'Chave inativa nesta sessão. Toque para ver como ativar.',
        body: [
          'A chave de criptografia não está ativa nesta sessão. Enquanto isso, o sistema não envia NIP e nome em texto claro para a nuvem — o acesso cifrado fica bloqueado até desbloquear a chave.',
          'Para ativar: saia da conta e entre novamente com e-mail e senha. Depois disso, o ícone fica verde e os cadastros seguem cifrados na nuvem.',
        ],
        footnote:
          'Verde = E2E confiável · Âmbar = aguardando/desatualizado · Vermelho = inativo',
      };
  }
}
