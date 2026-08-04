import type { ResultadoCorridaItem } from '../navigation/types';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { nipDigitos } from './nipFormat';

/** Sessão exibida no Histórico — um card por aplicação assinada. */
export type SessaoHistoricoAgrupada = SessaoAplicacaoTaf & {
  /** IDs das sessões originais consolidadas neste card. */
  idsOrigem?: string[];
};

function hashCurto(texto: string): string {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function rubricaAplicador(sessao: SessaoAplicacaoTaf): string {
  return sessao.aplicadorAssinatura?.rubricaSvg?.trim() ?? '';
}

/** Aplicação concluída = tem rúbrica do aplicador. */
export function isAplicacaoAssinadaPeloAplicador(sessao: SessaoAplicacaoTaf): boolean {
  return rubricaAplicador(sessao).length > 0;
}

/**
 * Chave de uma aplicação assinada: mesma rúbrica do mesmo aplicador no mesmo teste
 * = mesmo lançamento (vários militares gravados em sessões 1-a-1).
 * Rúbricas diferentes = lançamentos distintos, mesmo no mesmo dia.
 */
function chaveAplicacaoAssinada(sessao: SessaoAplicacaoTaf): string {
  const rubrica = rubricaAplicador(sessao);
  const a = sessao.aplicadorAssinatura;
  const aplicador =
    a?.aplicadorId?.trim() ||
    `${(a?.nip ?? '').trim()}:${(a?.nome ?? '').trim().toLowerCase()}` ||
    'aplicador';
  const norma = sessao.normaTaf ?? 'armada';
  return `${sessao.dataAplicacao}|${sessao.tipoProva}|${norma}|${aplicador}|${hashCurto(rubrica)}`;
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
  if (rubricaAplicador(s)) score += 80;
  if (s.aplicadorAssinatura?.nome || s.aplicadorAssinatura?.aplicadorId) score += 20;
  if (!s.id.startsWith('registrador-')) score += 30;
  if (s.id.startsWith('sessao-') || s.id.startsWith('demo-sess-') || s.id.startsWith('grupo-')) {
    score += 20;
  }
  score += Date.parse(s.criadoEm) / 1e13;
  return score;
}

function participantesCobertosPorAssinadas(
  assinadas: SessaoAplicacaoTaf[],
  cadastroTipoDataKey: (s: SessaoAplicacaoTaf) => string,
): Set<string> {
  const cobertos = new Set<string>();
  for (const s of assinadas) {
    const base = cadastroTipoDataKey(s);
    for (const r of s.resultados) {
      cobertos.add(`${base}|${chaveParticipante(r)}`);
    }
  }
  return cobertos;
}

function chaveTesteSemRubrica(sessao: SessaoAplicacaoTaf): string {
  const norma = sessao.normaTaf ?? 'armada';
  return `${sessao.dataAplicacao}|${sessao.tipoProva}|${norma}`;
}

function consolidarGrupo(membros: SessaoAplicacaoTaf[]): SessaoHistoricoAgrupada {
  if (membros.length === 1) {
    const unica = membros[0]!;
    return { ...unica, idsOrigem: [unica.id] };
  }

  const ordenados = [...membros].sort(
    (a, b) => pontuarSessaoPrimaria(b) - pontuarSessaoPrimaria(a),
  );
  const primaria = ordenados[0]!;
  const resultados = mesclarResultados(ordenados.map((s) => s.resultados));
  const aplicador =
    ordenados.find((s) => rubricaAplicador(s))?.aplicadorAssinatura ??
    ordenados.find((s) => s.aplicadorAssinatura)?.aplicadorAssinatura ??
    primaria.aplicadorAssinatura;
  const criadoEm = ordenados.map((s) => s.criadoEm).sort((a, b) => b.localeCompare(a))[0]!;

  return {
    ...primaria,
    criadoEm,
    resultados,
    aplicadorAssinatura: aplicador,
    idsOrigem: ordenados.map((s) => s.id),
  };
}

/**
 * Cards do Histórico: **1 card por aplicação assinada** (rúbrica do aplicador).
 * Sessões 1-a-1 do mesmo lançamento (mesma rúbrica) viram um único card com todos os militares.
 * Sessões sem rúbrica só aparecem se o militar ainda não estiver coberto por uma assinada.
 */
export function agruparSessoesHistoricoPorTeste(
  sessoes: SessaoAplicacaoTaf[],
): SessaoHistoricoAgrupada[] {
  const assinadas = sessoes.filter(isAplicacaoAssinadaPeloAplicador);
  const semRubrica = sessoes.filter((s) => !isAplicacaoAssinadaPeloAplicador(s));

  const gruposAssinados = new Map<string, SessaoAplicacaoTaf[]>();
  for (const sessao of assinadas) {
    const key = chaveAplicacaoAssinada(sessao);
    const lista = gruposAssinados.get(key);
    if (lista) lista.push(sessao);
    else gruposAssinados.set(key, [sessao]);
  }

  const cardsAssinados = Array.from(gruposAssinados.values()).map(consolidarGrupo);

  const cobertos = participantesCobertosPorAssinadas(cardsAssinados, chaveTesteSemRubrica);
  const orfas: SessaoAplicacaoTaf[] = [];
  for (const s of semRubrica) {
    const base = chaveTesteSemRubrica(s);
    const todosCobertos = s.resultados.every((r) =>
      cobertos.has(`${base}|${chaveParticipante(r)}`),
    );
    if (todosCobertos && s.resultados.length > 0) continue;
    orfas.push(s);
  }

  // Legado sem rúbrica: consolida por data+tipo+norma (evita 1 card por militar).
  const gruposOrfaos = new Map<string, SessaoAplicacaoTaf[]>();
  for (const sessao of orfas) {
    const key = chaveTesteSemRubrica(sessao);
    const lista = gruposOrfaos.get(key);
    if (lista) lista.push(sessao);
    else gruposOrfaos.set(key, [sessao]);
  }
  const cardsOrfaos = Array.from(gruposOrfaos.values()).map(consolidarGrupo);

  return [...cardsAssinados, ...cardsOrfaos].sort((a, b) =>
    b.criadoEm.localeCompare(a.criadoEm),
  );
}

export function idsSessaoHistoricoParaExcluir(sessao: SessaoHistoricoAgrupada): string[] {
  const ids = sessao.idsOrigem?.filter(Boolean) ?? [];
  if (ids.length > 0) return [...new Set(ids)];
  return sessao.id ? [sessao.id] : [];
}
