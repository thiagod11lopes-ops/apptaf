import { nipDigitos } from './nipFormat';
import { waitForAuthUid } from '../services/firebase/authUid';
import { getAllSessaoRubricasFirestore } from '../services/firebase/sessaoRubricasFirestore';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';

export type RubricasPorNip = {
  corrida?: string;
  natacao?: string;
  permanencia?: string;
};

/** Rúbricas das sessões — coleção leve `sessao_rubricas` (sem baixar sessões inteiras). */
export async function carregarRubricasDasSessoesPorNip(): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
  const uid = await waitForAuthUid();

  if (uid) {
    const docs = await getAllSessaoRubricasFirestore(uid);
    for (const doc of docs) {
      for (const r of doc.resultados) {
        const svg = r.rubricaCandidatoSvg?.trim();
        if (!svg) continue;
        const key = nipDigitos(r.nip);
        if (!key) continue;
        const atual = map.get(key) ?? {};
        if (r.prova === 'natacao') atual.natacao = svg;
        else if (r.prova === 'permanencia') atual.permanencia = svg;
        else atual.corrida = svg;
        map.set(key, atual);
      }
    }
    return map;
  }

  const sessoes = await getAllSessoesAplicacao();
  for (const sessao of sessoes) {
    for (const r of sessao.resultados) {
      const svg = r.rubricaCandidatoSvg?.trim();
      if (!svg) continue;
      const key = nipDigitos(r.nip);
      if (!key) continue;
      const prova = r.prova ?? sessao.tipoProva;
      const atual = map.get(key) ?? {};
      if (prova === 'natacao') atual.natacao = svg;
      else if (prova === 'permanencia') atual.permanencia = svg;
      else atual.corrida = svg;
      map.set(key, atual);
    }
  }

  return map;
}

export function rubricasDoCadastro(c: {
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
}): RubricasPorNip {
  return {
    corrida: c.rubricaCorridaSvg,
    natacao: c.rubricaNatacaoSvg,
    permanencia: c.rubricaPermanenciaSvg,
  };
}

export function mesclarRubricas(
  cadastro: RubricasPorNip,
  sessao?: RubricasPorNip,
): RubricasPorNip {
  return {
    corrida: cadastro.corrida ?? sessao?.corrida,
    natacao: cadastro.natacao ?? sessao?.natacao,
    permanencia: cadastro.permanencia ?? sessao?.permanencia,
  };
}
