export const FIRESTORE_COLLECTIONS = {
  cadastros: 'cadastros',
  sessoes: 'sessoes',
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
