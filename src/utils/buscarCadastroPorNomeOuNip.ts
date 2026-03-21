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

export type BuscaNomeNipResult =
  | { kind: 'found'; cadastro: CadastroItemPersist }
  | { kind: 'none' }
  | { kind: 'ambiguous' };

/**
 * Localiza um cadastro por NIP (dígitos, comparação exata) ou por nome
 * (igualdade sem acento/caixa; se não houver, um único resultado por inclusão no nome).
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
    if (porNip.length === 1) return { kind: 'found', cadastro: porNip[0] };
    if (porNip.length > 1) return { kind: 'ambiguous' };
  }

  const ql = stripDiacritics(q).toLowerCase();

  const porNomeExato = cadastros.filter(
    (c) => stripDiacritics((c.nome || '').trim()).toLowerCase() === ql
  );
  if (porNomeExato.length === 1) return { kind: 'found', cadastro: porNomeExato[0] };
  if (porNomeExato.length > 1) return { kind: 'ambiguous' };

  if (ql.length < 2) return { kind: 'none' };

  const porInclusao = cadastros.filter((c) =>
    stripDiacritics((c.nome || '').toLowerCase()).includes(ql)
  );
  if (porInclusao.length === 1) return { kind: 'found', cadastro: porInclusao[0] };
  if (porInclusao.length > 1) return { kind: 'ambiguous' };

  return { kind: 'none' };
}
