/**
 * Formata nome militar/aplicador com posto ou graduação à esquerda.
 * Ex.: "CT João da Silva", "MN Pedro Souza".
 */

export type PessoaComPostoGrad = {
  nome?: string | null;
  categoria?: 'Oficiais' | 'Praças' | string | null;
  oficial?: string | null;
  praca?: string | null;
};

function resolvePostoGrad(pessoa: PessoaComPostoGrad): string {
  if (pessoa.categoria === 'Oficiais') return (pessoa.oficial || '').trim();
  if (pessoa.categoria === 'Praças') return (pessoa.praca || '').trim();
  return (pessoa.oficial || '').trim() || (pessoa.praca || '').trim();
}

/** Une posto/graduação + nome (posto à esquerda). Evita duplicar se o nome já começa com o posto. */
export function formatNomeComPosto(pessoa: PessoaComPostoGrad): string {
  const nome = (pessoa.nome || '').trim() || '—';
  return formatNomeComPostoParts(resolvePostoGrad(pessoa), nome);
}

export function formatNomeComPostoParts(
  postoGrad: string | undefined | null,
  nome: string | undefined | null,
): string {
  const n = (nome || '').trim() || '—';
  const p = (postoGrad || '').trim();
  if (!p || p === '—') return n;
  const prefix = `${p} `;
  if (n.toUpperCase().startsWith(prefix.toUpperCase())) return n;
  return `${p} ${n}`;
}

/**
 * Posto + primeiro e segundo nome (prova ativa).
 * Se `nome` já vier com posto, preserva o posto e corta só os nomes.
 */
export function primeiroSegundoNomeComPosto(nomeOuNomeComPosto: string): string {
  const parts = nomeOuNomeComPosto.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return nomeOuNomeComPosto.trim() || '—';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;

  const first = parts[0]!;
  const looksLikePosto =
    /[0-9°º]/.test(first) ||
    (first.length <= 6 && first === first.toUpperCase() && /[A-ZÀ-Ú]/.test(first));

  if (looksLikePosto) {
    return `${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return `${parts[0]} ${parts[1]}`;
}
