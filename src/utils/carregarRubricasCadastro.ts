import { waitForAuthUid } from '../services/firebase/authUid';
import { getCadastroRubricasFirestore } from '../services/firebase/cadastroRubricasFirestore';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { rubricasDoCadastro } from './rubricasDasSessoes';

/** Baixa rúbricas SVG só dos cadastros solicitados. */
export async function carregarRubricasCadastrosPorIds(
  cadastroIds: string[],
): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  const uid = await waitForAuthUid();
  if (!uid || cadastroIds.length === 0) return map;

  const unique = [...new Set(cadastroIds)];
  await Promise.all(
    unique.map(async (id) => {
      const rub = await getCadastroRubricasFirestore(uid, id);
      if (rub) map.set(id, rubricasDoCadastro(rub));
    }),
  );

  return map;
}
