import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { nipDigitos } from './nipFormat';

/** Sessão exibida no Histórico — pode agregar várias sessões do mesmo teste. */
export type SessaoHistoricoAgrupada = SessaoAplicacaoTaf & {
  /** IDs das sessões originais quando o card representa um grupo consolidado. */
  idsOrigem?: string[];
};

function chaveGrupoTeste(sessao: SessaoAplicacaoTaf): string {
  const norma = sessao.normaTaf ?? 'armada';
  return `${sessao.dataAplicacao}|${sessao.tipoProva}|${norma}`;
}

function chaveParticipante(r: ResultadoCorridaItem): string {
  const d = nipDigitos(r.nip ?? '');
  if (d.length >= 8) return `nip:${d}`;
  const n = (r.nome ?? '').trim().toLowerCase();
  if (n.length >= 2) return `nome:${n}`;
  return `idx:${r.corredor}`;
}

function mesclarResultados(listas: ResultadoCorridaItem[][]): ResultadoCorridaItem[] {
  const map = new Map<string, ResultadoCorridaItem>();
  for (const lista of listas) {
    for (const r of lista) {
      const key = chaveParticipante(r);
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...r });
        continue;
      }
      const score = (x: ResultadoCorridaItem) =>
        (x.notaTexto ? 2 : 0) +
        (x.rubricaCandidatoSvg ? 2 : 0) +
        (x.tempoMs > 0 ? 1 : 0) +
        (x.desempenhoTexto ? 1 : 0);
      map.set(key, score(r) >= score(prev) ? { ...r } : prev);
    }
  }
  return Array.from(map.values()).map((r, i) => ({ ...r, corredor: i + 1 }));
}

function pontuarSessaoPrimaria(s: SessaoAplicacaoTaf): number {
  let score = s.resultados.length * 10;
  if (s.aplicadorAssinatura?.nome || s.aplicadorAssinatura?.aplicadorId) score += 50;
  if (!s.id.startsWith('registrador-')) score += 30;
  if (s.id.startsWith('sessao-') || s.id.startsWith('demo-sess-') || s.id.startsWith('grupo-')) {
    score += 20;
  }
  score += Date.parse(s.criadoEm) / 1e13;
  return score;
}

/**
 * Agrupa sessões do mesmo teste (mesma data + tipo de prova + norma)
 * em um único card no Histórico — ex.: 15 militares na mesma corrida ⇒ 1 card.
 */
export function agruparSessoesHistoricoPorTeste(
  sessoes: SessaoAplicacaoTaf[],
): SessaoHistoricoAgrupada[] {
  const grupos = new Map<string, SessaoAplicacaoTaf[]>();

  for (const sessao of sessoes) {
    const key = chaveGrupoTeste(sessao);
    const lista = grupos.get(key);
    if (lista) lista.push(sessao);
    else grupos.set(key, [sessao]);
  }

  const out: SessaoHistoricoAgrupada[] = [];

  for (const membros of grupos.values()) {
    if (membros.length === 1) {
      const unica = membros[0];
      out.push({ ...unica, idsOrigem: [unica.id] });
      continue;
    }

    const ordenados = [...membros].sort(
      (a, b) => pontuarSessaoPrimaria(b) - pontuarSessaoPrimaria(a),
    );
    const primaria = ordenados[0];
    const resultados = mesclarResultados(ordenados.map((s) => s.resultados));
    const aplicador =
      ordenados.find((s) => s.aplicadorAssinatura)?.aplicadorAssinatura ??
      primaria.aplicadorAssinatura;
    const criadoEm = ordenados
      .map((s) => s.criadoEm)
      .sort((a, b) => b.localeCompare(a))[0];

    out.push({
      ...primaria,
      criadoEm,
      resultados,
      aplicadorAssinatura: aplicador,
      idsOrigem: ordenados.map((s) => s.id),
    });
  }

  return out.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export function idsSessaoHistoricoParaExcluir(sessao: SessaoHistoricoAgrupada): string[] {
  const ids = sessao.idsOrigem?.filter(Boolean) ?? [];
  if (ids.length > 0) return [...new Set(ids)];
  return sessao.id ? [sessao.id] : [];
}
