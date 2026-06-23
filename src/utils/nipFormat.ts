/** Formato exibido no app: 00.0000.00 (8 dígitos). */
export const NIP_FORMATO_LABEL = '00.0000.00';

/** Formato exibido no app: 00.0000.00 (até 8 dígitos). */
export function formatNipInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const a = digits.slice(0, 2);
  const b = digits.slice(2, 6);
  const c = digits.slice(6, 8);

  if (digits.length <= 2) return a;
  if (digits.length <= 6) return `${a}.${digits.slice(2)}`;
  return `${a}.${b}.${c}`;
}

export function nipDigitos(value: string): string {
  return value.replace(/\D/g, '');
}

export type NipAnalise =
  | { valido: true; digitos: 8; formatado: string }
  | { valido: false; digitos: number; mensagem: string };

/** Valida NIP de cadastro: exatamente 8 dígitos no formato 00.0000.00. */
export function analisarNipCadastro(nip: string): NipAnalise {
  const bruto = (nip ?? '').trim();
  const digitos = nipDigitos(bruto);

  if (!digitos) {
    return { valido: false, digitos: 0, mensagem: 'NIP em branco' };
  }
  if (digitos.length < 8) {
    const faltam = 8 - digitos.length;
    return {
      valido: false,
      digitos: digitos.length,
      mensagem: `Faltam ${faltam} dígito${faltam > 1 ? 's' : ''} (informado: ${digitos.length})`,
    };
  }
  if (digitos.length > 8) {
    const extra = digitos.length - 8;
    return {
      valido: false,
      digitos: digitos.length,
      mensagem: `NIP com ${extra} dígito${extra > 1 ? 's' : ''} a mais (informado: ${digitos.length})`,
    };
  }

  const formatado = formatNipInput(digitos);
  if (bruto !== formatado) {
    return {
      valido: false,
      digitos: 8,
      mensagem: `Formato inválido (esperado: ${NIP_FORMATO_LABEL})`,
    };
  }

  return { valido: true, digitos: 8, formatado };
}

export function cadastroTemErroNip(c: { nip?: string }): boolean {
  return !analisarNipCadastro(c.nip ?? '').valido;
}

export function contarCadastrosComErroNip<T extends { nip?: string }>(cadastros: T[]): number {
  return cadastros.filter(cadastroTemErroNip).length;
}
