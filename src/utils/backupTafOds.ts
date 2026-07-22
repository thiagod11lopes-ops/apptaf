import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import {
  PLANILHA_TAF_MODELO_CONTENT_XML,
  PLANILHA_TAF_MODELO_MANIFEST_XML,
  PLANILHA_TAF_MODELO_META_XML,
  PLANILHA_TAF_MODELO_MIMETYPE,
  PLANILHA_TAF_MODELO_SETTINGS_XML,
  PLANILHA_TAF_MODELO_STYLES_XML,
} from '../assets/planilhaTafModelo/modeloEmbedded';
import { compareByNomePtBr } from './compareNomePtBr';
import { idadeFromDataNascimento } from './idadeFromDataNascimento';
import {
  cadastroComAlgumResultadoTaf,
  postoGradFromCadastro,
  temAvaliacaoCaminhada,
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { buildZipStoreOnly, utf8Bytes } from './zipStoreOnly';

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

/** Bloco de linhas vazias da aba Armada (após cabeçalho). */
const BLOCO_VAZIO_ARMADA =
  '<table:table-row table:style-name="ro3"><table:table-cell table:number-columns-repeated="10"/>' +
  '<table:table-cell table:style-name="ce32"/><table:table-cell table:style-name="ce33"/></table:table-row>' +
  '<table:table-row table:style-name="ro3" table:number-rows-repeated="14">' +
  '<table:table-cell table:number-columns-repeated="11"/><table:table-cell table:style-name="ce33"/></table:table-row>';

/** Bloco de linhas vazias da aba FN (após subcabeçalho BARRA/SOLO). */
const BLOCO_VAZIO_FN =
  '<table:table-row table:style-name="ro3" table:number-rows-repeated="14">' +
  '<table:table-cell table:number-columns-repeated="17"/></table:table-row>';

export type LinhaPlanilhaArmada = {
  pg: string;
  nip: string;
  nome: string;
  idade: string;
  corridaTempo: string;
  corridaPontos: string;
  natacaoTempo: string;
  natacaoPontos: string;
  permanencia: string;
  permanenciaPontos: string;
  geral: string;
  rubrica: string;
};

export type LinhaPlanilhaFn = {
  pg: string;
  nip: string;
  nome: string;
  idade: string;
  permanencia: string;
  permanenciaPontos: string;
  natacaoTempo: string;
  natacaoPontos: string;
  flexaoBarra: string;
  flexaoSolo: string;
  flexaoPontos: string;
  abdominal: string;
  abdominalPontos: string;
  corrida: string;
  corridaPontos: string;
  geral: string;
  rubrica: string;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  if (c.resultadoPermanencia === 'aprovado') return 'APROVADO';
  if (c.resultadoPermanencia === 'reprovado') return 'REPROVADO';
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

  for (const nota of [
    c.notaFlexaoBarra,
    c.notaFlexaoSolo,
    c.notaAbdominalRemador,
    c.notaAbdominalPrancha,
  ]) {
    const s = situacaoDeNota(nota);
    if (s) resultados.push(s);
  }

  if (resultados.length === 0) return '';
  if (resultados.some((r) => r === 'reprovado')) return 'REPROVADO';
  return 'APROVADO';
}

function dataCell(value: string, styleName: string): string {
  const v = value.trim();
  if (!v) {
    return `<table:table-cell table:style-name="${styleName}"/>`;
  }
  return (
    `<table:table-cell table:style-name="${styleName}" office:value-type="string" calcext:value-type="string">` +
    `<text:p>${escapeXml(v)}</text:p></table:table-cell>`
  );
}

/** Militar com ao menos um teste (Armada ou CFN) — só estes entram na planilha. */
export function cadastroComAlgumTestePlanilha(c: CadastroItemPersist): boolean {
  if (cadastroComAlgumResultadoTaf(c)) return true;
  return !!(
    c.repsFlexaoBarra != null ||
    (c.notaFlexaoBarra || '').trim() ||
    c.repsFlexaoSolo != null ||
    (c.notaFlexaoSolo || '').trim() ||
    c.repsAbdominalRemador != null ||
    (c.notaAbdominalRemador || '').trim() ||
    (c.tempoAbdominalPrancha || '').trim() ||
    (c.notaAbdominalPrancha || '').trim()
  );
}

export function filtrarCadastrosComTeste(cadastros: CadastroItemPersist[]): CadastroItemPersist[] {
  return cadastros.filter(cadastroComAlgumTestePlanilha);
}

export function montarLinhasArmada(cadastros: CadastroItemPersist[]): LinhaPlanilhaArmada[] {
  return filtrarCadastrosComTeste(cadastros).sort(compareByNomePtBr).map((c) => {
    const idade = idadeFromDataNascimento(c.dataNascimento);
    const pg = postoGradFromCadastro(c);
    return {
      pg: pg === '—' ? '' : pg,
      nip: (c.nip || '').trim(),
      nome: (c.nome || '').trim(),
      idade: idade == null ? '' : String(idade),
      corridaTempo: (c.tempoCorrida || '').trim(),
      corridaPontos: (c.notaCorrida || '').trim(),
      natacaoTempo: (c.tempoNatacao || '').trim(),
      natacaoPontos: (c.notaNatacao || '').trim(),
      permanencia: situacaoPermanencia(c),
      permanenciaPontos: '',
      geral: situacaoGeral(c),
      rubrica: hasRubrica(c) ? 'Assinado' : '',
    };
  });
}

export function montarLinhasFn(cadastros: CadastroItemPersist[]): LinhaPlanilhaFn[] {
  return filtrarCadastrosComTeste(cadastros).sort(compareByNomePtBr).map((c) => {
    const idade = idadeFromDataNascimento(c.dataNascimento);
    const pg = postoGradFromCadastro(c);
    const abdominal =
      c.repsAbdominalRemador != null
        ? String(c.repsAbdominalRemador)
        : (c.tempoAbdominalPrancha || '').trim();
    const abdominalPontos = (c.notaAbdominalRemador || c.notaAbdominalPrancha || '').trim();
    const flexaoPontos = (c.notaFlexaoBarra || c.notaFlexaoSolo || '').trim();

    return {
      pg: pg === '—' ? '' : pg,
      nip: (c.nip || '').trim(),
      nome: (c.nome || '').trim(),
      idade: idade == null ? '' : String(idade),
      permanencia: situacaoPermanencia(c),
      permanenciaPontos: '',
      natacaoTempo: (c.tempoNatacao || '').trim(),
      natacaoPontos: (c.notaNatacao || '').trim(),
      flexaoBarra: c.repsFlexaoBarra != null ? String(c.repsFlexaoBarra) : '',
      flexaoSolo: c.repsFlexaoSolo != null ? String(c.repsFlexaoSolo) : '',
      flexaoPontos,
      abdominal,
      abdominalPontos,
      corrida: (c.tempoCorrida || '').trim(),
      corridaPontos: (c.notaCorrida || '').trim(),
      geral: situacaoGeral(c),
      rubrica: hasRubrica(c) ? 'Assinado' : '',
    };
  });
}

function rowArmadaXml(row: LinhaPlanilhaArmada): string {
  const s = 'ce9';
  return (
    `<table:table-row table:style-name="ro3">` +
    dataCell(row.pg, s) +
    dataCell(row.nip, s) +
    dataCell(row.nome, s) +
    dataCell(row.idade, s) +
    dataCell(row.corridaTempo, s) +
    dataCell(row.corridaPontos, s) +
    dataCell(row.natacaoTempo, s) +
    dataCell(row.natacaoPontos, s) +
    dataCell(row.permanencia, s) +
    dataCell(row.permanenciaPontos, s) +
    dataCell(row.geral, 'ce25') +
    dataCell(row.rubrica, s) +
    `</table:table-row>`
  );
}

function rowFnXml(row: LinhaPlanilhaFn): string {
  const s = 'ce36';
  return (
    `<table:table-row table:style-name="ro3">` +
    dataCell(row.pg, s) +
    dataCell(row.nip, s) +
    dataCell(row.nome, s) +
    dataCell(row.idade, s) +
    dataCell(row.permanencia, s) +
    dataCell(row.permanenciaPontos, s) +
    dataCell(row.natacaoTempo, s) +
    dataCell(row.natacaoPontos, s) +
    dataCell(row.flexaoBarra, s) +
    dataCell(row.flexaoSolo, s) +
    dataCell(row.flexaoPontos, s) +
    dataCell(row.abdominal, s) +
    dataCell(row.abdominalPontos, s) +
    dataCell(row.corrida, s) +
    dataCell(row.corridaPontos, s) +
    dataCell(row.geral, 'ce25') +
    dataCell(row.rubrica, s) +
    `</table:table-row>`
  );
}

function linhaVaziaArmada(): string {
  return (
    `<table:table-row table:style-name="ro3">` +
    `<table:table-cell table:style-name="ce9" table:number-columns-repeated="10"/>` +
    `<table:table-cell table:style-name="ce32"/>` +
    `<table:table-cell table:style-name="ce33"/>` +
    `</table:table-row>`
  );
}

function linhaVaziaFn(): string {
  return (
    `<table:table-row table:style-name="ro3">` +
    `<table:table-cell table:style-name="ce36" table:number-columns-repeated="17"/>` +
    `</table:table-row>`
  );
}

function preencherBlocoArmada(linhas: LinhaPlanilhaArmada[]): string {
  const minLinhas = 15;
  const parts = linhas.map(rowArmadaXml);
  const faltam = Math.max(0, minLinhas - parts.length);
  for (let i = 0; i < faltam; i++) parts.push(linhaVaziaArmada());
  return parts.join('');
}

function preencherBlocoFn(linhas: LinhaPlanilhaFn[]): string {
  const minLinhas = 14;
  const parts = linhas.map(rowFnXml);
  const faltam = Math.max(0, minLinhas - parts.length);
  for (let i = 0; i < faltam; i++) parts.push(linhaVaziaFn());
  return parts.join('');
}

/** Injeta cadastros no content.xml do modelo HNMD TAF 2026. */
export function buildPlanilhaTafContentXml(cadastros: CadastroItemPersist[]): string {
  const ano = String(new Date().getFullYear());
  let xml = PLANILHA_TAF_MODELO_CONTENT_XML.replace(
    /TESTE DE APTIDÃO FÍSICA \(TAF\) 2026/g,
    `TESTE DE APTIDÃO FÍSICA (TAF) ${ano}`,
  );

  const armada = montarLinhasArmada(cadastros);
  const fn = montarLinhasFn(cadastros);

  if (!xml.includes(BLOCO_VAZIO_ARMADA)) {
    throw new Error('Modelo ODS Armada inválido: bloco de linhas não encontrado.');
  }
  if (!xml.includes(BLOCO_VAZIO_FN)) {
    throw new Error('Modelo ODS FN inválido: bloco de linhas não encontrado.');
  }

  xml = xml.replace(BLOCO_VAZIO_ARMADA, preencherBlocoArmada(armada));
  xml = xml.replace(BLOCO_VAZIO_FN, preencherBlocoFn(fn));
  return xml;
}

/** Gera bytes do arquivo ODS no formato da planilha HNMD anexada. */
export function buildBackupOdsBytes(cadastros: CadastroItemPersist[]): Uint8Array {
  const contentXml = buildPlanilhaTafContentXml(cadastros);

  return buildZipStoreOnly([
    { name: 'mimetype', data: utf8Bytes(PLANILHA_TAF_MODELO_MIMETYPE.trim()) },
    { name: 'content.xml', data: utf8Bytes(contentXml) },
    { name: 'styles.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_STYLES_XML) },
    { name: 'meta.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_META_XML) },
    { name: 'settings.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_SETTINGS_XML) },
    { name: 'META-INF/manifest.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_MANIFEST_XML) },
  ]);
}

export function buildBackupOdsBlob(cadastros: CadastroItemPersist[]): Blob {
  const bytes = buildBackupOdsBytes(cadastros);
  return new Blob([bytes], { type: ODS_MIME });
}

export const ODS_MIME_TYPE = ODS_MIME;
