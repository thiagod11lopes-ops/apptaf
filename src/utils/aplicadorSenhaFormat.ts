/** Senha numérica de exatamente 4 dígitos. */
export const SENHA_APLICADOR_LENGTH = 4;

export function formatSenhaAplicadorInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, SENHA_APLICADOR_LENGTH);
}

export function isSenhaAplicadorValid(senha: string): boolean {
  return new RegExp(`^\\d{${SENHA_APLICADOR_LENGTH}}$`).test(senha.trim());
}
