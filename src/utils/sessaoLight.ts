import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';

export type SessaoResultadoRubrica = {
  nip: string;
  prova: 'corrida' | 'natacao' | 'permanencia';
  rubricaCandidatoSvg: string;
};

/** Garante campos mínimos — docs light/tombstone no Firestore podem omitir resultados. */
export function normalizeSessaoShape(
  sessao: Partial<SessaoAplicacaoTaf> & { id: string },
): SessaoAplicacaoTaf {
  return {
    id: sessao.id,
    criadoEm: sessao.criadoEm ?? '',
    dataAplicacao: sessao.dataAplicacao ?? '',
    tipoProva: sessao.tipoProva ?? 'corrida',
    resultados: Array.isArray(sessao.resultados) ? sessao.resultados : [],
    ...(sessao.aplicadorAssinatura ? { aplicadorAssinatura: sessao.aplicadorAssinatura } : {}),
    ...(sessao.updatedAt != null ? { updatedAt: sessao.updatedAt } : {}),
  };
}

export function extractSessaoRubricas(sessao: SessaoAplicacaoTaf): SessaoResultadoRubrica[] {
  const out: SessaoResultadoRubrica[] = [];
  const normalized = normalizeSessaoShape(sessao);
  for (const r of normalized.resultados) {
    const svg = r.rubricaCandidatoSvg?.trim();
    if (!svg) continue;
    const prova = r.prova ?? normalized.tipoProva;
    out.push({ nip: r.nip, prova, rubricaCandidatoSvg: svg });
  }
  return out;
}

export function toSessaoLight(sessao: SessaoAplicacaoTaf): SessaoAplicacaoTaf {
  const base = normalizeSessaoShape(sessao);
  return {
    ...base,
    resultados: base.resultados.map((r) => {
      const { rubricaCandidatoSvg: _r, ...rest } = r;
      return rest as ResultadoCorridaItem;
    }),
  };
}
