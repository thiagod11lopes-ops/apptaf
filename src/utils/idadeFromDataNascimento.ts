/**
 * Calcula a idade em anos a partir de uma data no formato DD/MM/AAAA.
 * Retorna null se a data for inválida ou vazia.
 */
export function idadeFromDataNascimento(dataStr: string): number | null {
  const t = (dataStr || '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10) - 1;
  const yyyy = parseInt(m[3], 10);
  const nasc = new Date(yyyy, mm, dd);
  if (
    nasc.getFullYear() !== yyyy ||
    nasc.getMonth() !== mm ||
    nasc.getDate() !== dd
  ) {
    return null;
  }

  const hoje = new Date();
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const mesDiff = hoje.getMonth() - nasc.getMonth();
  if (mesDiff < 0 || (mesDiff === 0 && hoje.getDate() < nasc.getDate())) {
    idade -= 1;
  }
  return idade >= 0 ? idade : null;
}

/** Texto para exibição na tabela: número da idade ou "-" */
export function idadeDisplayFromDataNascimento(dataStr: string): string {
  const idade = idadeFromDataNascimento(dataStr);
  return idade === null ? '-' : String(idade);
}
