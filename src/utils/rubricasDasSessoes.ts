import { nipDigitos } from './nipFormat';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';

export type RubricasPorNip = {
  corrida?: string;
  natacao?: string;
  permanencia?: string;
};

/** Rúbricas das sessões — somente IndexedDB (offline-first). */
export async function carregarRubricasDasSessoesPorNip(): Promise<Map<string, RubricasPorNip>> {
  const map = new Map<string, RubricasPorNip>();
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
