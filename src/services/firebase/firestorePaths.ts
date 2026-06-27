export const FIRESTORE_COLLECTIONS = {
  cadastros: 'cadastros',
  sessoes: 'sessoes',
  cadastroRubricas: 'cadastro_rubricas',
  sessaoRubricas: 'sessao_rubricas',
  aplicadores: 'aplicadores',
  emailsAutorizados: 'emails_autorizados',
  preCadastros: 'pre_cadastros',
} as const;

/** Dados do usuário autenticado: users/{uid}/cadastros, users/{uid}/sessoes */
export function userRootPath(uid: string): string {
  return `users/${uid}`;
}

export function userCadastrosPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.cadastros}`;
}

export function userSessoesPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.sessoes}`;
}

export function userCadastroRubricasPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.cadastroRubricas}`;
}

export function userSessaoRubricasPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.sessaoRubricas}`;
}

export function userAplicadoresPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.aplicadores}`;
}

export function userPreCadastrosPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.preCadastros}`;
}

export function userAuthorizedEmailsPath(uid: string): string {
  return `${userRootPath(uid)}/${FIRESTORE_COLLECTIONS.emailsAutorizados}`;
}
