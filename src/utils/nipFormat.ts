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
