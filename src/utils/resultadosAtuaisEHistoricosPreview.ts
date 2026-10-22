import type { ResultadoCorridaItem } from '../navigation/types';
import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  deleteSessaoAplicacao,
  tituloTipoProva,
  updateSessaoAplicacao,
  type SessaoAplicacaoTaf,
  type TipoProvaAplicada,
} from '../services/resultadosAplicadosIndexedDb';
import {
  getRecordUpdatedAt,
  parseDataAplicacaoBr,
} from '../services/offline/recordTimestamps';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { formatTempoColunaResultado } from './formatTempoColunaResultado';
import { isNotaReprovacaoTexto } from './notaReprovacaoTexto';
import { nipChaveCadastro, nipDigitos } from './nipFormat';
import { PERMANENCIA_TEMPO_PDF_PADRAO } from './exportResultadosTafPdf';
import { postoGradFromCadastro } from './resultadoTafCadastro';
import {
  montarBlocosResultadosTafPorAplicador,
  type ResultadosTafPdfBloco,
} from './resultadosTafPdfPorAplicador';
import type { RubricasPorNip } from './rubricasDasSessoes';
import { excluirResultadoSubstituido, listarResultadosSubstituidos } from '../services/resultadosSubstituidosStorage';

/** Resultado anterior (mesma prova, mesmo militar) — exibido como histórico na prévia. */
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

function normalizeNome(nome: string): string {
  try {
    return nome
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  } catch {
    return nome.trim().toLowerCase();
  }
}

/**
 * Identidade estável do militar para agrupar a mesma pessoa entre sessões
 * (cadastro > NIP > nome), evitando duplicar “atual” quando NIP/nome variam.
 */
function identidadeParticipante(
  r: ResultadoCorridaItem,
  cadastros: CadastroItemPersist[],
): {
  key: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
} {
  const busca = buscarCadastroPorNomeOuNip(
    cadastros,
    (r.nip || '').trim() || (r.nome || '').trim(),
  );
  const cadastro = busca.kind === 'found' ? busca.cadastro : undefined;
  const nip = (r.nip || cadastro?.nip || '').trim();
  const nome = (r.nome || cadastro?.nome || '').trim();
  const nipKey = nipDigitos(nip);
  const key = cadastro?.id
    ? `id:${cadastro.id}`
    : nipKey
      ? `nip:${nipKey}`
      : nome
        ? `nome:${normalizeNome(nome)}`
        : '';
  return {
    key,
    nip: nip || '—',
    nome: nome || '—',
    postoGrad: cadastro ? postoGradFromCadastro(cadastro) : undefined,
    cadastroId: cadastro?.id,
  };
}

type Ocorrencia = {
  sessaoId: string;
  resultadoIndex: number;
  tipoProva: TipoProvaAplicada;
  participanteKey: string;
  nip: string;
  nome: string;
  postoGrad?: string;
  cadastroId?: string;
  dataAplicacao: string;
  tempo: string;
  nota: string;
  situacao: string;
  /** updatedAt/criadoEm da sessão. */
  recordTime: number;
  /** Timestamp da data de aplicação (DD/MM/AAAA). */
  dataTime: number;
};

function compararOcorrenciaRecente(a: Ocorrencia, b: Ocorrencia): number {
  // Mais recente por data de aplicação; desempate por updatedAt/criadoEm e id da sessão.
  if (a.dataTime !== b.dataTime) return b.dataTime - a.dataTime;
  if (a.recordTime !== b.recordTime) return b.recordTime - a.recordTime;
  return b.sessaoId.localeCompare(a.sessaoId);
}

function coletarOcorrencias(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
): Ocorrencia[] {
  const out: Ocorrencia[] = [];
  for (const sessao of sessoes) {
    const tipo = sessao.tipoProva;
    const recordTime = getRecordUpdatedAt(sessao);
    const dataTime = parseDataAplicacaoBr(sessao.dataAplicacao);
    for (let i = 0; i < sessao.resultados.length; i++) {
      const r = sessao.resultados[i]!;
      const ident = identidadeParticipante(r, cadastros);
      if (!ident.key) continue;
      out.push({
        sessaoId: sessao.id,
        resultadoIndex: i,
        tipoProva: tipo,
        participanteKey: ident.key,
        nip: ident.nip,
        nome: ident.nome,
        postoGrad: ident.postoGrad,
        cadastroId: ident.cadastroId,
        dataAplicacao: sessao.dataAplicacao,
        tempo: tempoFromResultado(tipo, r),
        nota: notaFromResultado(r),
        situacao: situacaoFromResultado(r),
        recordTime,
        dataTime,
      });
    }
  }
  return out;
}

/** Une chaves do mesmo militar+prova — NIP primeiro (evita split por cadastro duplicado). */
function chaveGrupoCanonico(o: Ocorrencia): string {
  const nip = nipChaveCadastro(o.nip) || nipDigitos(o.nip);
  if (nip.length >= 8) return `nip:${nip.slice(0, 8)}|${o.tipoProva}`;
  if (nip.length > 0) return `nip:${nip}|${o.tipoProva}`;
  if (o.cadastroId) return `id:${o.cadastroId}|${o.tipoProva}`;
  return `${o.participanteKey}|${o.tipoProva}`;
}

/**
 * Por militar + prova: mantém só o resultado mais recente nas sessões;
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
    const key = chaveGrupoCanonico(o);
    const list = porChave.get(key) ?? [];
    list.push(o);
    porChave.set(key, list);
  }

  // Une aliases do mesmo militar+prova (id vs nip vs nome sem cadastro).
  const grupos = Array.from(porChave.entries());
  const consumido = new Set<string>();
  const gruposFinais: Ocorrencia[][] = [];

  for (let i = 0; i < grupos.length; i++) {
    const [keyA, listA] = grupos[i]!;
    if (consumido.has(keyA)) continue;
    let merged = [...listA];
    const amostra = listA[0]!;
    const nipA = nipDigitos(amostra.nip);
    const nomeA = normalizeNome(amostra.nome);

    for (let j = i + 1; j < grupos.length; j++) {
      const [keyB, listB] = grupos[j]!;
      if (consumido.has(keyB)) continue;
      const b = listB[0]!;
      if (amostra.tipoProva !== b.tipoProva) continue;

      const nipB = nipDigitos(b.nip);
      const nomeB = normalizeNome(b.nome);
      const mesmoCadastro =
        !!amostra.cadastroId && !!b.cadastroId && amostra.cadastroId === b.cadastroId;
      const mesmoNip =
        nipA.length > 0 &&
        nipB.length > 0 &&
        (nipA === nipB ||
          (nipA.length >= 8 && nipB.length >= 8 && nipA.slice(0, 8) === nipB.slice(0, 8)));
      const mesmoNome =
        nomeA.length >= 5 &&
        nomeA === nomeB &&
        (!nipA || !nipB || mesmoNip || !amostra.cadastroId || !b.cadastroId);

      if (mesmoCadastro || mesmoNip || mesmoNome) {
        merged = merged.concat(listB);
        consumido.add(keyB);
      }
    }
    consumido.add(keyA);
    gruposFinais.push(merged);
  }

  /** Chave estável da ocorrência atual: sessão + índice do resultado. */
  const atuaisOccKeys = new Set<string>();
  const historicos: HistoricoProvaPreviewItem[] = [];

  for (const list of gruposFinais) {
    list.sort(compararOcorrenciaRecente);
    const [atual, ...anteriores] = list;
    if (!atual) continue;
    atuaisOccKeys.add(`${atual.sessaoId}#${atual.resultadoIndex}`);
    for (const ant of anteriores) {
      historicos.push({
        id: `sess:${ant.sessaoId}:${ant.resultadoIndex}:${ant.tipoProva}:${ant.dataTime || ant.recordTime}`,
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
        sortTime: ant.dataTime || ant.recordTime,
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
    const filtrados = sessao.resultados.filter((_, i) =>
      atuaisOccKeys.has(`${sessao.id}#${i}`),
    );
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
  // Só as sessões de cada aplicador — não unifica com o cadastro/registrador,
  // senão todas as provas do militar aparecem no bloco de quem aplicou só uma.
  const blocos = montarBlocosResultadosTafPorAplicador({
    sessoes: sessoesAtuais,
    cadastros: opts.cadastros,
    rubricasSessoes: opts.rubricasSessoes,
    rubricasCadastros: opts.rubricasCadastros,
    somenteSessoesInformadas: true,
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
    return;
  }

  const nipKey = nipDigitos(item.nip);
  const nomeKey = normalizeNome(item.nome);
  const filtrados = sessao.resultados.filter((r) => {
    const rNip = nipDigitos(r.nip);
    if (nipKey && rNip) return rNip !== nipKey;
    if (item.cadastroId) {
      // Sem NIP no resultado: remove por nome quando bate com o item.
      if (nomeKey && normalizeNome(r.nome || '') === nomeKey) return false;
      return true;
    }
    if (nipKey) return true;
    return normalizeNome(r.nome || '') !== nomeKey;
  });

  if (filtrados.length === sessao.resultados.length) return;
  if (filtrados.length === 0) {
    await deleteSessaoAplicacao(sessao.id);
  } else {
    await updateSessaoAplicacao({ ...sessao, resultados: filtrados });
  }
}
