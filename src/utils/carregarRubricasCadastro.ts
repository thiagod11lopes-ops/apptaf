import {
  getCadastroRubricasLocalByIds,
} from '../offline-first/db/localDbRubricas';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { rubricasDoCadastro } from './rubricasDasSessoes';

/** Carrega imagens de rúbrica dos cadastros — side table local (PDF). */
export async function carregarRubricasCadastrosPorIds(
  cadastroIds: string[],
): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  if (cadastroIds.length === 0) return map;

  const byId = await getCadastroRubricasLocalByIds(cadastroIds);
  for (const [id, rub] of byId) {
    map.set(id, rubricasDoCadastro(rub));
  }
  return map;
}
