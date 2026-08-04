import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';

/** Sessão exibida no Histórico — um card por aplicação (sessão). */
export type SessaoHistoricoAgrupada = SessaoAplicacaoTaf & {
  /** IDs das sessões originais (hoje sempre `[id]` da própria sessão). */
  idsOrigem?: string[];
};

/**
 * Cards do Histórico: **uma aplicação = um card**.
 * Não consolida mais sessões do mesmo dia/tipo/prova (evita fundir lançamentos distintos).
 */
export function agruparSessoesHistoricoPorTeste(
  sessoes: SessaoAplicacaoTaf[],
): SessaoHistoricoAgrupada[] {
  return [...sessoes]
    .map((s) => ({ ...s, idsOrigem: [s.id] }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function idsSessaoHistoricoParaExcluir(sessao: SessaoHistoricoAgrupada): string[] {
  const ids = sessao.idsOrigem?.filter(Boolean) ?? [];
  if (ids.length > 0) return [...new Set(ids)];
  return sessao.id ? [sessao.id] : [];
}
