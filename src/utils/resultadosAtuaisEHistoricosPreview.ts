import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  deleteSessaoAplicacao,
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import { getSessaoSortTime } from '../services/offline/recordTimestamps';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { formatTempoColunaResultado } from './formatTempoColunaResultado';
import { isNotaReprovacaoTexto } from './notaReprovacaoTexto';
import { nipDigitos } from './nipFormat';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { postoGradFromCadastro } from './resultadoTafCadastro';
import {
  montarBlocosResultadosTafPorAplicador,
  type ResultadosTafPdfBloco,
} from './resultadosTafPdfPorAplicador';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { excluirResultadoSubstituido, listarResultadosSubstituidos } from '../services/resultadosSubstituidosStorage';

/** Resultado anterior (mesma prova, mesmo NIP) — exibido como histórico na prévia. */
export type HistoricoProvaPreviewItem = {
  id: string;
  sessaoId: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
  modalidade: TipoProvaAplicada;
  modalidadeLabel: string;
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  sortTime: number;
  /** Origem: sessão antiga ou arquivo de substituição. */
  origem: 'sessao' | 'arquivo';
};

function situacaoFromResultado(r: ResultadoCorridaItem): string {
  if (r.reprovacaoTexto?.trim()) return r.reprovacaoTexto.trim();
  const nota = (r.notaTexto ?? r.noraTexto ?? '').trim();
  if (isNotaReprovacaoTexto(nota)) return 'Reprovado';
  if (nota.toLowerCase() === 'aprovado') return 'Aprovado';
  if (nota) return 'Aprovado';
  return '—';
}

function tempoFromResultado(tipo: TipoProvaAplicada, r: ResultadoCorridaItem): string {
  if (tipo === 'permanencia') return PERMANENCIA_TEMPO_PDF_PADRAO;
  return formatTempoColunaResultado({ ...r, prova: r.prova ?? tipo });
}

function notaFromResultado(r: ResultadoCorridaItem): string {
  const t = (r.notaTexto ?? r.noraTexto ?? '').trim();
  return t || '—';
}

function chaveNipProva(nipKey: string, tipo: TipoProvaAplicada): string {
  // nipKey já vem normalizado (dígitos ou fallback nome:…).
  return `${nipKey}|${tipo}`;
}

type Ocorrencia = {
  sessaoId: string;
  tipoProva: TipoProvaAplicada;
  nipKey: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  sortTime: number;
  resultado: ResultadoCorridaItem;
};

function coletarOcorrencias(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  for (const sessao of sessoes) {
    const tipo = sessao.tipoProva;
    const sortTime = getSessaoSortTime(sessao);
    for (const r of sessao.resultados) {
      const nipKey = nipDigitos(r.nip);
      if (!nipKey && !(r.nome || '').trim()) continue;
      const busca = buscarCadastroPorNomeOuNip(
        cadastros,
        (r.nip || '').trim() || (r.nome || '').trim(),
      );
      const cadastro = busca.kind === 'found' ? busca.cadastro : undefined;
      out.push({
        sessaoId: sessao.id,
        tipoProva: tipo,
        nipKey: nipKey || `nome:${(r.nome || '').trim().toLowerCase()}`,
        nip: (r.nip || cadastro?.nip || '').trim() || '—',
        nome: (r.nome || cadastro?.nome || '').trim() || '—',
        postoGrad: cadastro ? postoGradFromCadastro(cadastro) : undefined,
        cadastroId: cadastro?.id,
        dataAplicacao: sessao.dataAplicacao,
        tempo: tempoFromResultado(tipo, r),
        nota: notaFromResultado(r),
        situacao: situacaoFromResultado(r),
        sortTime,
        resultado: r,
      });
    }
  }
  return out;
}

/**
 * Por NIP + prova: mantém só o resultado mais recente nas sessões;
 * os anteriores viram histórico da prévia.
 */
export function classificarSessoesAtuaisEHistoricos(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): {
  sessoesAtuais: SessaoAplicacaoTaf[];
  historicos: HistoricoProvaPreviewItem[];
} {
  const ocorrencias = coletarOcorrencias(sessoes, cadastros);
  const porChave = new Map<string, Ocorrencia[]>();
  for (const o of ocorrencias) {
    const key = chaveNipProva(o.nipKey, o.tipoProva);
    const list = porChave.get(key) ?? [];
    list.push(o);
    porChave.set(key, list);
  }

  const atuaisKeys = new Set<string>();
  const historicos: HistoricoProvaPreviewItem[] = [];

  for (const [, list] of porChave) {
    list.sort((a, b) => b.sortTime - a.sortTime || b.sessaoId.localeCompare(a.sessaoId));
    const [atual, ...anteriores] = list;
    if (!atual) continue;
    atuaisKeys.add(`${atual.sessaoId}|${atual.nipKey}|${atual.tipoProva}`);
    for (const ant of anteriores) {
      historicos.push({
        id: `sess:${ant.sessaoId}:${ant.nipKey}:${ant.tipoProva}:${ant.sortTime}`,
        sessaoId: ant.sessaoId,
        nip: ant.nip,
        nome: ant.nome,
        postoGrad: ant.postoGrad,
        cadastroId: ant.cadastroId,
        modalidade: ant.tipoProva,
        modalidadeLabel: tituloTipoProva(ant.tipoProva),
        dataAplicacao: ant.dataAplicacao,
        tempo: ant.tempo,
        nota: ant.nota,
        situacao: ant.situacao,
        sortTime: ant.sortTime,
        origem: 'sessao',
      });
    }
  }

  historicos.sort(
    (a, b) =>
      b.sortTime - a.sortTime ||
      a.nome.localeCompare(b.nome, 'pt-BR') ||
      a.modalidadeLabel.localeCompare(b.modalidadeLabel, 'pt-BR'),
  );

  const sessoesAtuais: SessaoAplicacaoTaf[] = [];
  for (const sessao of sessoes) {
    const filtrados = sessao.resultados.filter((r) => {
      const nipKey = nipDigitos(r.nip) || `nome:${(r.nome || '').trim().toLowerCase()}`;
      return atuaisKeys.has(`${sessao.id}|${nipKey}|${sessao.tipoProva}`);
    });
    if (filtrados.length === 0) continue;
    if (filtrados.length === sessao.resultados.length) {
      sessoesAtuais.push(sessao);
    } else {
      sessoesAtuais.push({ ...sessao, resultados: filtrados });
    }
  }

  return { sessoesAtuais, historicos };
}

export async function mesclarHistoricosArquivo(
  historicosSessao: HistoricoProvaPreviewItem[],
): Promise<HistoricoProvaPreviewItem[]> {
  const arquivo = await listarResultadosSubstituidos();
  const idsSessao = new Set(
    historicosSessao.map(
      (h) => `${nipDigitos(h.nip)}|${h.modalidade}|${h.dataAplicacao}|${h.nota}|${h.tempo}`,
    ),
  );
  const extra: HistoricoProvaPreviewItem[] = [];
  for (const row of arquivo) {
    const key = `${nipDigitos(row.nip)}|${row.modalidade}|${row.dataAplicacao}|${row.nota}|${row.tempo}`;
    if (idsSessao.has(key)) continue;
    extra.push({
      id: `arq:${row.id}`,
      sessaoId: row.sessaoId || '',
      nip: row.nip,
      nome: row.nome,
      postoGrad: row.postoGrad,
      cadastroId: row.cadastroId,
      modalidade: row.modalidade,
      modalidadeLabel: row.modalidadeLabel,
      dataAplicacao: row.dataAplicacao,
      tempo: row.tempo,
      nota: row.nota,
      situacao: row.situacao,
      sortTime: row.replacedAt,
      origem: 'arquivo',
    });
  }
  return [...historicosSessao, ...extra].sort(
    (a, b) => b.sortTime - a.sortTime || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

export function montarBlocosPreviewSomenteAtuais(opts: {
  sessoes: SessaoAplicacaoTaf[];
  cadastros: CadastroItemPersist[];
  rubricasSessoes?: Map<string, RubricasPorNip>;
  rubricasCadastros?: Map<string, RubricasPorNip>;
}): { blocos: ResultadosTafPdfBloco[]; historicosSessao: HistoricoProvaPreviewItem[] } {
  const { sessoesAtuais, historicos } = classificarSessoesAtuaisEHistoricos(
    opts.sessoes,
    opts.cadastros,
  );
  const blocos = montarBlocosResultadosTafPorAplicador({
    sessoes: sessoesAtuais,
    cadastros: opts.cadastros,
    rubricasSessoes: opts.rubricasSessoes,
    rubricasCadastros: opts.rubricasCadastros,
    somenteSessoesInformadas: false,
  });
  return { blocos, historicosSessao: historicos };
}

/**
 * Remove um resultado histórico do sistema (sessão antiga e/ou arquivo Dexie).
 */
export async function excluirHistoricoProvaPreview(
  item: HistoricoProvaPreviewItem,
): Promise<void> {
  if (item.origem === 'arquivo') {
    const arqId = item.id.startsWith('arq:') ? item.id.slice(4) : item.id;
    await excluirResultadoSubstituido(arqId);
    return;
  }

  if (!item.sessaoId) return;
  const { getAllSessoesAplicacao } = await import('../services/resultadosAplicadosIndexedDb');
  const sessoes = await getAllSessoesAplicacao({ includeDemo: true });
  const sessao = sessoes.find((s) => s.id === item.sessaoId);
  if (!sessao) {
    // Sessão já sumiu — tenta limpar arquivo espelho se houver.
    return;
  }

  const nipKey = nipDigitos(item.nip);
  const filtrados = sessao.resultados.filter((r) => {
    const rKey = nipDigitos(r.nip);
    if (nipKey && rKey) return rKey !== nipKey;
    if (nipKey) return true;
    return (r.nome || '').trim().toLowerCase() !== (item.nome || '').trim().toLowerCase();
  });

  if (filtrados.length === sessao.resultados.length) return;
  if (filtrados.length === 0) {
    await deleteSessaoAplicacao(sessao.id);
  } else {
    await updateSessaoAplicacao({ ...sessao, resultados: filtrados });
  }
}
