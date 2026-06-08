import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';

function cadastroScore(item: CadastroItemPersist): number {
  return Object.values(item).filter((v) => v != null && v !== '').length;
}

/** Remove duplicatas na nuvem (mesmo NIP, IDs diferentes). */
export function dedupeCadastrosPorNip(items: CadastroItemPersist[]): CadastroItemPersist[] {
  const porNip = new Map<string, CadastroItemPersist>();
  const semNip: CadastroItemPersist[] = [];

  for (const item of items) {
    const nip = item.nip?.trim();
    if (!nip) {
      semNip.push(item);
      continue;
    }
    const atual = porNip.get(nip);
    if (!atual || cadastroScore(item) >= cadastroScore(atual)) {
      porNip.set(nip, item);
    }
  }

  return [...porNip.values(), ...semNip];
}
