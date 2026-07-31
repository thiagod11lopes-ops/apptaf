import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

function stripDiacritics(s: string): string {
  try {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  } catch {
    return s;
  }
}

function nipDigits(s: string): string {
  return (s || '').replace(/\D/g, '');
}

/** Token curto em maiúsculas, ou com °/dígito — tipicamente posto/graduação (CT, 1°TEN, MN…). */
function looksLikePostoToken(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (/[0-9°º]/.test(t)) return true;
  return t.length <= 6 && t === t.toUpperCase() && /[A-ZÀ-Ú]/.test(t);
}

export type BuscaNomeNipResult =
  | { kind: 'found'; cadastro: CadastroItemPersist }
  | { kind: 'none' }
  | { kind: 'ambiguous' };

function buscarPorNome(
  cadastros: CadastroItemPersist[],
  q: string,
): BuscaNomeNipResult {
  const ql = stripDiacritics(q).toLowerCase();

  const porNomeExato = cadastros.filter(
    (c) => stripDiacritics((c.nome || '').trim()).toLowerCase() === ql
  );
  if (porNomeExato.length === 1) return { kind: 'found', cadastro: porNomeExato[0]! };
  if (porNomeExato.length > 1) return { kind: 'ambiguous' };

  if (ql.length < 2) return { kind: 'none' };

  const porInclusao = cadastros.filter((c) =>
    stripDiacritics((c.nome || '').toLowerCase()).includes(ql)
  );
  if (porInclusao.length === 1) return { kind: 'found', cadastro: porInclusao[0]! };
  if (porInclusao.length > 1) return { kind: 'ambiguous' };

  return { kind: 'none' };
}

/**
 * Localiza um cadastro por NIP (dígitos, comparação exata) ou por nome
 * (igualdade sem acento/caixa; se não houver, um único resultado por inclusão no nome).
 * Se a busca completa falhar e o 1º token parecer posto/graduação, tenta sem ele
 * (ex.: "CT João Silva" → "João Silva").
 */
export function buscarCadastroPorNomeOuNip(
  cadastros: CadastroItemPersist[],
  raw: string
): BuscaNomeNipResult {
  const q = raw.trim();
  if (!q) return { kind: 'none' };

  const qD = nipDigits(q);
  if (qD.length > 0) {
    const porNip = cadastros.filter((c) => nipDigits(c.nip) === qD);
    if (porNip.length === 1) return { kind: 'found', cadastro: porNip[0]! };
    if (porNip.length > 1) return { kind: 'ambiguous' };
  }

  const porNome = buscarPorNome(cadastros, q);
  if (porNome.kind !== 'none') return porNome;

  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && looksLikePostoToken(parts[0]!)) {
    const semPosto = parts.slice(1).join(' ');
    return buscarPorNome(cadastros, semPosto);
  }

  return { kind: 'none' };
}
