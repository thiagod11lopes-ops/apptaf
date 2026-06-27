import { resolveStorageOwnerUid } from '../services/firebase/authUid';
import { dataStore } from '../offline-first/store/DataStore';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { rubricasDoCadastro } from './rubricasDasSessoes';

/** Carrega rúbricas SVG dos cadastros solicitados — somente IndexedDB. */
export async function carregarRubricasCadastrosPorIds(
  cadastroIds: string[],
): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  if (cadastroIds.length === 0) return map;

  const uid = await resolveStorageOwnerUid();
  const cadastros = await dataStore.getCadastros(uid);
  const byId = new Map(cadastros.map((c) => [c.id, c]));

  for (const id of [...new Set(cadastroIds)]) {
    const cad = byId.get(id);
    if (cad) map.set(id, rubricasDoCadastro(cad));
  }

  return map;
}
