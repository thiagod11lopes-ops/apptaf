/**
 * Formata nome militar/aplicador com posto ou graduação à esquerda.
 * Ex.: "CT João da Silva", "MN Pedro Souza", "CB RM2 Fulano".
 */

/**
 * Postos e graduações da Marinha do Brasil (Armada + CFN).
 * Usado para detectar se um nome já começa com um posto/graduação e evitar duplicação.
 */
export const POSTOS_GRADUACOES_CONHECIDOS = new Set([
  // Praças Armada
  'MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO',
  // Praças CFN
  'SD',
  // Oficiais
  'GM', '2°TEN', '1°TEN', 'CT', 'CC', 'CF', 'CMG', 'CALTE',
  // Variações sem símbolo de grau
  '3SG', '2SG', '1SG', '2TEN', '1TEN',
]);

/**
 * Retorna o nome puro sem posto/graduação à esquerda.
 * Ex.: "MN FABIO APARICIO" → "FABIO APARICIO", "SD JOSE" → "JOSE".
 */
export function nomeBareSemPosto(nomeMilitar: string): string {
  const parts = nomeMilitar.trim().split(/\s+/);
  if (parts.length < 2) return nomeMilitar.trim();
  const first = (parts[0] ?? '').toUpperCase();
  if (!POSTOS_GRADUACOES_CONHECIDOS.has(first)) return nomeMilitar.trim();
  // Strip posto; se o segundo token for "RM2" (vínculo), strip também.
  if (parts.length >= 3 && (parts[1] ?? '').toUpperCase() === 'RM2') {
    return parts.slice(2).join(' ');
  }
  return parts.slice(1).join(' ');
}

export type PessoaComPostoGrad = {
  nome?: string | null;
  categoria?: 'Oficiais' | 'Praças' | string | null;
  oficial?: string | null;
  praca?: string | null;
  /** Quando `rm2`, anexa " RM2" ao posto/graduação. */
  vinculo?: 'carreira' | 'rm2' | null;
};

function resolvePostoGradBase(pessoa: PessoaComPostoGrad): string {
  if (pessoa.categoria === 'Oficiais') return (pessoa.oficial || '').trim();
  if (pessoa.categoria === 'Praças') return (pessoa.praca || '').trim();
  return (pessoa.oficial || '').trim() || (pessoa.praca || '').trim();
}

/** Posto/graduação, com " RM2" à direita quando o vínculo for RM2. */
export function postoGradComVinculo(
  postoGrad: string | undefined | null,
  vinculo?: 'carreira' | 'rm2' | null,
): string {
  const p = (postoGrad || '').trim();
  if (vinculo !== 'rm2') return p;
  if (!p || p === '—') return 'RM2';
  if (/(^|\s)RM2$/i.test(p)) return p;
  return `${p} RM2`;
}

function resolvePostoGrad(pessoa: PessoaComPostoGrad): string {
  return postoGradComVinculo(resolvePostoGradBase(pessoa), pessoa.vinculo);
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
  // Se o nome começa com um posto/graduação conhecido diferente do atual,
  // substitui pelo posto correto: "MN FABIO" + postoGrad "SD" → "SD FABIO APARICIO".
  const primeiraWord = (n.split(/\s+/)[0] ?? '').toUpperCase();
  if (POSTOS_GRADUACOES_CONHECIDOS.has(primeiraWord)) {
    return `${p} ${nomeBareSemPosto(n)}`;
  }
  return `${p} ${n}`;
}

/**
 * Posto + primeiro e segundo nome (prova ativa).
 * Se `nome` já vier com posto (e opcionalmente RM2), preserva e corta só os nomes.
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
    if ((parts[1] ?? '').toUpperCase() === 'RM2') {
      return parts.slice(0, Math.min(4, parts.length)).join(' ');
    }
    return `${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return `${parts[0]} ${parts[1]}`;
}
