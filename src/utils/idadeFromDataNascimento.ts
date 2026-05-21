import { calcularIdadeAnos } from './calcularIdade';

/**
 * Calcula a idade em anos a partir de uma data no formato DD/MM/AAAA.
 * Retorna null se a data for inválida ou vazia.
 * Usa a data de hoje como referência (mesma regra de `calcularIdadeAnos`).
 */
export function idadeFromDataNascimento(
  dataStr: string,
  refDate: Date = new Date(),
): number | null {
  const t = (dataStr || '').trim();
  if (!t) return null;
  const idade = calcularIdadeAnos(t, refDate);
  return idade == null || idade < 0 ? null : idade;
}

/** Texto para exibição na tabela: número da idade ou "-" */
export function idadeDisplayFromDataNascimento(dataStr: string): string {
  const idade = idadeFromDataNascimento(dataStr);
  return idade === null ? '-' : String(idade);
}
