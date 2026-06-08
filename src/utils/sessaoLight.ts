import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';

export type SessaoResultadoRubrica = {
  nip: string;
  prova: 'corrida' | 'natacao' | 'permanencia';
  rubricaCandidatoSvg: string;
};

export function extractSessaoRubricas(sessao: SessaoAplicacaoTaf): SessaoResultadoRubrica[] {
  const out: SessaoResultadoRubrica[] = [];
  for (const r of sessao.resultados) {
    const svg = r.rubricaCandidatoSvg?.trim();
    if (!svg) continue;
    const prova = r.prova ?? sessao.tipoProva;
    out.push({ nip: r.nip, prova, rubricaCandidatoSvg: svg });
  }
  return out;
}

export function toSessaoLight(sessao: SessaoAplicacaoTaf): SessaoAplicacaoTaf {
  return {
    ...sessao,
    resultados: sessao.resultados.map((r) => {
      const { rubricaCandidatoSvg: _r, ...rest } = r;
      return rest as ResultadoCorridaItem;
    }),
  };
}
