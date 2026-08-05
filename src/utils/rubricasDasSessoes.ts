import { nipDigitos } from './nipFormat';
import { listSessaoRubricasLocal } from '../offline-first/db/localDbRubricas';
import { getCachedDataOwnerUid } from '../services/firebase/authUid';
import { isRubricaImagemDataUrl } from './rubricaPresence';

export type RubricasPorNip = {
  corrida?: string;
  caminhada?: string;
  natacao?: string;
  permanencia?: string;
};

/** Rúbricas das sessões — side table local (imagens reais para PDF). */
export async function carregarRubricasDasSessoesPorNip(): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  const ownerUid = getCachedDataOwnerUid();
  if (!ownerUid) return map;

  const rows = await listSessaoRubricasLocal(ownerUid);
  for (const row of rows) {
    for (const r of row.resultados ?? []) {
      const svg = r.rubricaCandidatoSvg?.trim();
      if (!isRubricaImagemDataUrl(svg)) continue;
      const key = nipDigitos(r.nip);
      if (!key) continue;
      const prova = r.prova;
      const atual = map.get(key) ?? {};
      if (prova === 'natacao') atual.natacao = svg;
      else if (prova === 'permanencia') atual.permanencia = svg;
      else if (prova === 'caminhada') atual.caminhada = svg;
      else atual.corrida = svg;
      map.set(key, atual);
    }
  }

  return map;
}

export function rubricasDoCadastro(c: {
  rubricaCorridaSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
}): RubricasPorNip {
  const pick = (v?: string) => (isRubricaImagemDataUrl(v) ? v : undefined);
  return {
    corrida: pick(c.rubricaCorridaSvg),
    caminhada: pick(c.rubricaCaminhadaSvg),
    natacao: pick(c.rubricaNatacaoSvg),
    permanencia: pick(c.rubricaPermanenciaSvg),
  };
}

export function mesclarRubricas(
  cadastro: RubricasPorNip,
  sessao?: RubricasPorNip,
): RubricasPorNip {
  return {
    corrida: cadastro.corrida ?? sessao?.corrida,
    caminhada: cadastro.caminhada ?? sessao?.caminhada,
    natacao: cadastro.natacao ?? sessao?.natacao,
    permanencia: cadastro.permanencia ?? sessao?.permanencia,
  };
}
