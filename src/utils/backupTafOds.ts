import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { compareByNomePtBr } from './compareNomePtBr';
import { idadeFromDataNascimento } from './idadeFromDataNascimento';
import {
  postoGradFromCadastro,
  temAvaliacaoCaminhada,
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { buildZipStoreOnly, utf8Bytes } from './zipStoreOnly';

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

export type PlanilhaTafColuna =
  | 'pg'
  | 'nip'
  | 'nome'
  | 'idade'
  | 'corridaTempo'
  | 'corridaPontos'
  | 'caminhadaTempo'
  | 'caminhadaPontos'
  | 'natacaoTempo'
  | 'natacaoPontos'
  | 'permanencia'
  | 'flexaoBarra'
  | 'flexaoBarraPontos'
  | 'flexaoSolo'
  | 'flexaoSoloPontos'
  | 'abdominal'
  | 'abdominalPontos'
  | 'geral'
  | 'rubrica';

const COLUNA_LABEL: Record<PlanilhaTafColuna, string> = {
  pg: 'P/G',
  nip: 'NIP',
  nome: 'NOME',
  idade: 'IDADE',
  corridaTempo: 'CORRIDA TEMPO',
  corridaPontos: 'CORRIDA PONTOS',
  caminhadaTempo: 'CAMINHADA TEMPO',
  caminhadaPontos: 'CAMINHADA PONTOS',
  natacaoTempo: 'NATAÇÃO TEMPO',
  natacaoPontos: 'NATAÇÃO PONTOS',
  permanencia: 'PERMANÊNCIA',
  flexaoBarra: 'FLEXÃO BARRA',
  flexaoBarraPontos: 'FLEXÃO BARRA PONTOS',
  flexaoSolo: 'FLEXÃO SOLO',
  flexaoSoloPontos: 'FLEXÃO SOLO PONTOS',
  abdominal: 'ABDOMINAL',
  abdominalPontos: 'ABDOMINAL PONTOS',
  geral: 'APROVADO OU REPROVADO',
  rubrica: 'RUBRICA',
};

type LinhaPlanilha = Record<PlanilhaTafColuna, string>;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cellXml(value: string): string {
  const v = value.trim();
  if (!v) {
    return '<table:table-cell/>';
  }
  return `<table:table-cell office:value-type="string"><text:p>${escapeXml(v)}</text:p></table:table-cell>`;
}

function hasRubrica(c: CadastroItemPersist): boolean {
  return !!(
    c.rubricaCorridaSvg?.trim() ||
    c.rubricaCaminhadaSvg?.trim() ||
    c.rubricaNatacaoSvg?.trim() ||
    c.rubricaPermanenciaSvg?.trim()
  );
}

function situacaoDeNota(nota: string | undefined): 'aprovado' | 'reprovado' | null {
  const n = (nota || '').trim();
  if (!n || n === '—') return null;
  if (n.toUpperCase() === 'REPROVADO') return 'reprovado';
  return 'aprovado';
}

function situacaoPermanencia(c: CadastroItemPersist): string {
  if (c.resultadoPermanencia === 'aprovado') return 'Aprovado';
  if (c.resultadoPermanencia === 'reprovado') return 'Reprovado';
  return '';
}

function situacaoGeral(c: CadastroItemPersist): string {
  const resultados: Array<'aprovado' | 'reprovado'> = [];

  if (temAvaliacaoCorrida(c)) {
    const s = situacaoDeNota(c.notaCorrida);
    if (s) resultados.push(s);
  }
  if (temAvaliacaoCaminhada(c)) {
    const s = situacaoDeNota(c.notaCaminhada);
    if (s) resultados.push(s);
  }
  if (temAvaliacaoNatacao(c)) {
    if (c.resultadoNatacao === 'aprovado' || c.resultadoNatacao === 'reprovado') {
      resultados.push(c.resultadoNatacao);
    } else {
      const s = situacaoDeNota(c.notaNatacao);
      if (s) resultados.push(s);
    }
  }
  if (temAvaliacaoPermanencia(c) && c.resultadoPermanencia) {
    resultados.push(c.resultadoPermanencia);
  }

  const flexoes: Array<string | undefined> = [
    c.notaFlexaoBarra,
    c.notaFlexaoSolo,
    c.notaAbdominalRemador,
    c.notaAbdominalPrancha,
  ];
  for (const nota of flexoes) {
    const s = situacaoDeNota(nota);
    if (s) resultados.push(s);
  }

  if (resultados.length === 0) return '';
  if (resultados.some((r) => r === 'reprovado')) return 'REPROVADO';
  return 'APROVADO';
}

function linhaFromCadastro(c: CadastroItemPersist): LinhaPlanilha {
  const idade = idadeFromDataNascimento(c.dataNascimento);
  const pg = postoGradFromCadastro(c);
  const abdominalReps =
    c.repsAbdominalRemador != null
      ? String(c.repsAbdominalRemador)
      : (c.tempoAbdominalPrancha || '').trim();
  const abdominalNota = (c.notaAbdominalRemador || c.notaAbdominalPrancha || '').trim();

  return {
    pg: pg === '—' ? '' : pg,
    nip: (c.nip || '').trim(),
    nome: (c.nome || '').trim(),
    idade: idade == null ? '' : String(idade),
    corridaTempo: (c.tempoCorrida || '').trim(),
    corridaPontos: (c.notaCorrida || '').trim(),
    caminhadaTempo: (c.tempoCaminhada || '').trim(),
    caminhadaPontos: (c.notaCaminhada || '').trim(),
    natacaoTempo: (c.tempoNatacao || '').trim(),
    natacaoPontos: (c.notaNatacao || '').trim(),
    permanencia: situacaoPermanencia(c),
    flexaoBarra: c.repsFlexaoBarra != null ? String(c.repsFlexaoBarra) : '',
    flexaoBarraPontos: (c.notaFlexaoBarra || '').trim(),
    flexaoSolo: c.repsFlexaoSolo != null ? String(c.repsFlexaoSolo) : '',
    flexaoSoloPontos: (c.notaFlexaoSolo || '').trim(),
    abdominal: abdominalReps,
    abdominalPontos: abdominalNota,
    geral: situacaoGeral(c),
    rubrica: hasRubrica(c) ? 'Assinado' : '',
  };
}

const ORDEM_COLUNAS: PlanilhaTafColuna[] = [
  'pg',
  'nip',
  'nome',
  'idade',
  'corridaTempo',
  'corridaPontos',
  'caminhadaTempo',
  'caminhadaPontos',
  'natacaoTempo',
  'natacaoPontos',
  'permanencia',
  'flexaoBarra',
  'flexaoBarraPontos',
  'flexaoSolo',
  'flexaoSoloPontos',
  'abdominal',
  'abdominalPontos',
  'geral',
  'rubrica',
];

/** Colunas com pelo menos um valor não vazio nas linhas. */
export function colunasComConteudo(linhas: LinhaPlanilha[]): PlanilhaTafColuna[] {
  return ORDEM_COLUNAS.filter((col) => linhas.some((row) => row[col].trim()));
}

export function montarLinhasPlanilhaTaf(cadastros: CadastroItemPersist[]): LinhaPlanilha[] {
  return [...cadastros].sort(compareByNomePtBr).map(linhaFromCadastro);
}

function buildContentXml(linhas: LinhaPlanilha[], colunas: PlanilhaTafColuna[]): string {
  const colCount = Math.max(colunas.length, 1);
  const title =
    '<table:table-row>' +
    `<table:table-cell office:value-type="string" table:number-columns-spanned="${colCount}">` +
    '<text:p>TESTE DE APTIDÃO FÍSICA (TAF) — AppTAF</text:p>' +
    '</table:table-cell>' +
    (colCount > 1
      ? `<table:covered-table-cell table:number-columns-repeated="${colCount - 1}"/>`
      : '') +
    '</table:table-row>';

  let header = '<table:table-row>';
  let body = '';

  if (colunas.length === 0) {
    header += cellXml('Sem dados de cadastro');
    header += '</table:table-row>';
  } else {
    for (const col of colunas) {
      header += cellXml(COLUNA_LABEL[col]);
    }
    header += '</table:table-row>';

    for (const row of linhas) {
      body += '<table:table-row>';
      for (const col of colunas) {
        body += cellXml(row[col]);
      }
      body += '</table:table-row>';
    }
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ` +
    `xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" ` +
    `xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" ` +
    `xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" ` +
    `office:version="1.2">` +
    `<office:body><office:spreadsheet>` +
    `<table:table table:name="TAF">` +
    `<table:table-column table:number-columns-repeated="${colCount}"/>` +
    title +
    header +
    body +
    `</table:table></office:spreadsheet></office:body></office:document-content>`
  );
}

function buildStylesXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" office:version="1.2">` +
    `<office:styles/>` +
    `</office:document-styles>`
  );
}

function buildMetaXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" ` +
    `xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.2">` +
    `<office:meta><meta:generator>AppTAF</meta:generator></office:meta>` +
    `</office:document-meta>`
  );
}

function buildManifestXml(): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">` +
    `<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="${ODS_MIME}"/>` +
    `<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>` +
    `<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>` +
    `</manifest:manifest>`
  );
}

/** Gera bytes do arquivo ODS (planilha TAF) a partir dos cadastros. */
export function buildBackupOdsBytes(cadastros: CadastroItemPersist[]): Uint8Array {
  const linhas = montarLinhasPlanilhaTaf(cadastros);
  const colunas = colunasComConteudo(linhas);
  const contentXml = buildContentXml(linhas, colunas);

  return buildZipStoreOnly([
    { name: 'mimetype', data: utf8Bytes(ODS_MIME) },
    { name: 'content.xml', data: utf8Bytes(contentXml) },
    { name: 'styles.xml', data: utf8Bytes(buildStylesXml()) },
    { name: 'meta.xml', data: utf8Bytes(buildMetaXml()) },
    { name: 'META-INF/manifest.xml', data: utf8Bytes(buildManifestXml()) },
  ]);
}

export function buildBackupOdsBlob(cadastros: CadastroItemPersist[]): Blob {
  const bytes = buildBackupOdsBytes(cadastros);
  return new Blob([bytes], { type: ODS_MIME });
}

export const ODS_MIME_TYPE = ODS_MIME;
