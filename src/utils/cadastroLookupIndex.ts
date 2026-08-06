import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  buscarCadastroPorNomeOuNip,
  type BuscaNomeNipResult,
} from './buscarCadastroPorNomeOuNip';
import { nipDigitos } from './nipFormat';

export type CadastroLookupIndex = {
  byId: Map<string, CadastroItemPersist>;
  /** NIP com ≥8 dígitos → cadastro (primeiro; ambíguos ficam fora do mapa). */
  byNip: Map<string, CadastroItemPersist>;
  /** NIPs com mais de um cadastro. */
  nipAmbiguo: Set<string>;
};

/** Índice O(1) por id/NIP — use em loops quentes de Resultados. */
export function buildCadastroLookupIndex(
  cadastros: CadastroItemPersist[],
): CadastroLookupIndex {
  const byId = new Map<string, CadastroItemPersist>();
  const byNip = new Map<string, CadastroItemPersist>();
  const nipAmbiguo = new Set<string>();

  for (const c of cadastros) {
    byId.set(c.id, c);
    const d = nipDigitos(c.nip);
    if (d.length < 8) continue;
    if (nipAmbiguo.has(d)) continue;
    const prev = byNip.get(d);
    if (prev && prev.id !== c.id) {
      byNip.delete(d);
      nipAmbiguo.add(d);
      continue;
    }
    byNip.set(d, c);
  }

  return { byId, byNip, nipAmbiguo };
}

/**
 * Lookup por NIP via índice; nome (e posto) cai no scan linear só quando necessário.
 */
export function buscarCadastroIndexed(
  index: CadastroLookupIndex,
  cadastros: CadastroItemPersist[],
  raw: string,
): BuscaNomeNipResult {
  const q = (raw ?? '').trim();
  if (!q) return { kind: 'none' };

  const qD = nipDigitos(q);
  if (qD.length > 0) {
    if (index.nipAmbiguo.has(qD)) return { kind: 'ambiguous' };
    const hit = index.byNip.get(qD);
    if (hit) return { kind: 'found', cadastro: hit };
    // NIP parcial / curto: fallback linear (mesmo comportamento do original).
    if (qD.length < 8) {
      return buscarCadastroPorNomeOuNip(cadastros, q);
    }
  }

  return buscarCadastroPorNomeOuNip(cadastros, q);
}
