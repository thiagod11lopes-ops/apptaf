import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { dedupeCadastrosByNipNewest } from '../services/offline/conflictMerge';

/** Remove duplicatas na nuvem (mesmo NIP) — mantém o registro mais recente. */
export function dedupeCadastrosPorNip(items: CadastroItemPersist[]): CadastroItemPersist[] {
  return dedupeCadastrosByNipNewest(items);
}
