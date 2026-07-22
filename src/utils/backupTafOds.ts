import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
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
import { nipDigitos } from './nipFormat';
import { normalizarRubricaSvgDataUrl } from './rubricaSvgNormalize';
import {
  rubricasDoCadastro,
  type RubricasPorNip,
} from './rubricasDasSessoes';
import {
  cadastroComAlgumResultadoTaf,
  cadastroComPendenciaParcialTaf,
  cadastroComTafCompleto,
  postoGradFromCadastro,
  temAvaliacaoCaminhada,
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';
import { dataBrParaIso } from './tafRegistro';
import { buildZipStoreOnly, utf8Bytes, type ZipStoreEntry } from './zipStoreOnly';

const ODS_MIME = 'application/vnd.oasis.opendocument.spreadsheet';

/** Bloco de linhas vazias da aba Armada (após cabeçalho) — 11 colunas (sem nota de permanência). */
const BLOCO_VAZIO_ARMADA =
  '<table:table-row table:style-name="ro3"><table:table-cell table:number-columns-repeated="9"/>' +
  '<table:table-cell table:style-name="ce32"/><table:table-cell table:style-name="ce33"/></table:table-row>' +
  '<table:table-row table:style-name="ro3" table:number-rows-repeated="14">' +
  '<table:table-cell table:number-columns-repeated="10"/><table:table-cell table:style-name="ce33"/></table:table-row>';

/** Bloco vazio original do modelo HNMD (12 colunas, com nota de permanência). */
const BLOCO_VAZIO_ARMADA_MODELO =
  '<table:table-row table:style-name="ro3"><table:table-cell table:number-columns-repeated="10"/>' +
  '<table:table-cell table:style-name="ce32"/><table:table-cell table:style-name="ce33"/></table:table-row>' +
  '<table:table-row table:style-name="ro3" table:number-rows-repeated="14">' +
  '<table:table-cell table:number-columns-repeated="11"/><table:table-cell table:style-name="ce33"/></table:table-row>';

/** Bloco de linhas vazias da aba FN (após subcabeçalho BARRA/SOLO). */
const BLOCO_VAZIO_FN =
  '<table:table-row table:style-name="ro3" table:number-rows-repeated="14">' +
  '<table:table-cell table:number-columns-repeated="17"/></table:table-row>';

/** Espaço vazio sob o título — aba Armada (2 linhas). */
const BLOCO_ESPACO_TITULO_ARMADA =
  '<table:table-row table:style-name="ro3"><table:table-cell table:style-name="ce6" table:number-columns-spanned="11" table:number-rows-spanned="1"/>' +
  '<table:covered-table-cell table:number-columns-repeated="10" table:style-name="ce19"/><table:table-cell/></table:table-row>' +
  '<table:table-row table:style-name="ro3"><table:table-cell table:style-name="ce6" table:number-columns-spanned="11" table:number-rows-spanned="1"/>' +
  '<table:covered-table-cell table:number-columns-repeated="10" table:style-name="ce19"/><table:table-cell/></table:table-row>';

/** Espaço vazio sob o título — aba FN (2 linhas). */
const BLOCO_ESPACO_TITULO_FN =
  '<table:table-row table:style-name="ro3"><table:table-cell table:style-name="ce6" table:number-columns-spanned="11" table:number-rows-spanned="1"/>' +
  '<table:covered-table-cell table:number-columns-repeated="10" table:style-name="ce19"/>' +
  '<table:table-cell table:style-name="Default" table:number-columns-repeated="6"/></table:table-row>' +
  '<table:table-row table:style-name="ro3"><table:table-cell table:style-name="ce6" table:number-columns-spanned="11" table:number-rows-spanned="1"/>' +
  '<table:covered-table-cell table:number-columns-repeated="10" table:style-name="ce19"/>' +
  '<table:table-cell table:style-name="Default" table:number-columns-repeated="6"/></table:table-row>';

const ESTILOS_EXTRA =
  `<style:style style:name="roRubrica" style:family="table-row">` +
  `<style:table-row-properties style:row-height="1.15cm" fo:break-before="auto" style:use-optimal-row-height="false"/>` +
  `</style:style>` +
  `<style:style style:name="roBalanco" style:family="table-row">` +
  `<style:table-row-properties style:row-height="0.62cm" fo:break-before="auto" style:use-optimal-row-height="false"/>` +
  `</style:style>` +
  `<style:style style:name="grRubrica" style:family="graphic">` +
  `<style:graphic-properties draw:stroke="none" draw:fill="none"/>` +
  `</style:style>` +
  `<style:style style:name="ceRubrica" style:family="table-cell" style:parent-style-name="Default">` +
  `<style:table-cell-properties fo:border="0.06pt solid #000000" style:vertical-align="middle"/>` +
  `<style:paragraph-properties fo:text-align="center"/>` +
  `</style:style>` +
  estiloCelulaCor('cePontosVerde', '#15803d') +
  estiloCelulaCor('cePontosVermelho', '#dc2626') +
  estiloCelulaCor('cePermAprovado', '#15803d') +
  estiloCelulaCor('cePermReprovado', '#dc2626') +
  estiloCelulaCor('ceTestePendente', '#ea580c') +
  estiloCelulaCor('ceGeralAprovado', '#15803d') +
  estiloCelulaCor('ceGeralReprovado', '#dc2626') +
  `<style:style style:name="ceBalancoTitulo" style:family="table-cell" style:parent-style-name="Default">` +
  `<style:table-cell-properties fo:background-color="#1e3a5f" fo:border="0.06pt solid #1e3a5f" style:vertical-align="middle"/>` +
  `<style:paragraph-properties fo:text-align="center"/>` +
  `<style:text-properties style:font-name="Calibri" fo:color="#ffffff" fo:font-size="11pt" fo:font-weight="bold" ` +
  `style:font-size-asian="11pt" style:font-weight-asian="bold" style:font-size-complex="11pt" style:font-weight-complex="bold"/>` +
  `</style:style>` +
  `<style:style style:name="ceBalancoLabel" style:family="table-cell" style:parent-style-name="Default">` +
  `<style:table-cell-properties fo:background-color="#e8eef5" fo:border="0.06pt solid #94a3b8" style:vertical-align="middle"/>` +
  `<style:paragraph-properties fo:text-align="center"/>` +
  `<style:text-properties style:font-name="Calibri" fo:color="#1e293b" fo:font-size="9pt" fo:font-weight="bold" ` +
  `style:font-size-asian="9pt" style:font-weight-asian="bold" style:font-size-complex="9pt" style:font-weight-complex="bold"/>` +
  `</style:style>` +
  `<style:style style:name="ceBalancoValor" style:family="table-cell" style:parent-style-name="Default">` +
  `<style:table-cell-properties fo:background-color="#ffffff" fo:border="0.06pt solid #94a3b8" style:vertical-align="middle"/>` +
  `<style:paragraph-properties fo:text-align="center"/>` +
  `<style:text-properties style:font-name="Calibri" fo:color="#0f172a" fo:font-size="12pt" fo:font-weight="bold" ` +
  `style:font-size-asian="12pt" style:font-weight-asian="bold" style:font-size-complex="12pt" style:font-weight-complex="bold"/>` +
  `</style:style>`;

function estiloCelulaCor(name: string, color: string): string {
  return (
    `<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default">` +
    `<style:table-cell-properties fo:border="0.06pt solid #000000" style:vertical-align="middle"/>` +
    `<style:paragraph-properties fo:text-align="center"/>` +
    `<style:text-properties style:font-name="Calibri" fo:color="${color}" fo:font-weight="bold" ` +
    `style:font-weight-asian="bold" style:font-weight-complex="bold"/>` +
    `</style:style>`
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type BalancoPlanilhaTaf = {
  cadastrados: number;
  parcial: number;
  completo: number;
};

/** Totais do balanço sob o título da planilha. */
export function calcularBalancoPlanilhaTaf(cadastros: CadastroItemPersist[]): BalancoPlanilhaTaf {
  return {
    cadastrados: cadastros.length,
    parcial: cadastros.filter(cadastroComPendenciaParcialTaf).length,
    completo: cadastros.filter(cadastroComTafCompleto).length,
  };
}

function balancoCell(text: string, style: string, span = 1): string {
  const spanAttr = span > 1 ? ` table:number-columns-spanned="${span}"` : '';
  const covered =
    span > 1
      ? `<table:covered-table-cell table:number-columns-repeated="${span - 1}" table:style-name="${style}"/>`
      : '';
  return (
    `<table:table-cell table:style-name="${style}" office:value-type="string" calcext:value-type="string"${spanAttr}>` +
    `<text:p>${escapeXml(text)}</text:p></table:table-cell>${covered}`
  );
}

function balancoValorCell(n: number): string {
  return balancoCell(String(n), 'ceBalancoValor', 1);
}

function padColsFn(extra: number): string {
  if (extra <= 0) return '';
  return `<table:table-cell table:style-name="Default" table:number-columns-repeated="${extra}"/>`;
}

/**
 * Balanço no formato da planilha de referência (Atualizada.ods):
 * título e métricas em células simples (sem span) — a coluna P/G já é larga o bastante.
 * Campos: Militares cadastrados | Parcial | Completo.
 */
export function buildBalancoXml(balanco: BalancoPlanilhaTaf, colsTotal: 11 | 17): string {
  const metricCols = 6;
  const titulo =
    `<table:table-row table:style-name="roBalanco">` +
    balancoCell('BALANÇO DE QUANTIDADE', 'ceBalancoTitulo', 1) +
    padColsFn(colsTotal - 1) +
    `</table:table-row>`;

  const metricas =
    `<table:table-row table:style-name="roBalanco">` +
    balancoCell('Militares cadastrados', 'ceBalancoLabel', 1) +
    balancoValorCell(balanco.cadastrados) +
    balancoCell('Parcial', 'ceBalancoLabel', 1) +
    balancoValorCell(balanco.parcial) +
    balancoCell('Completo', 'ceBalancoLabel', 1) +
    balancoValorCell(balanco.completo) +
    padColsFn(colsTotal - metricCols) +
    `</table:table-row>`;

  const espaco =
    `<table:table-row table:style-name="ro3">` +
    `<table:table-cell table:style-name="ce6" table:number-columns-spanned="11" table:number-rows-spanned="1"/>` +
    `<table:covered-table-cell table:number-columns-repeated="10" table:style-name="ce19"/>` +
    (colsTotal > 11
      ? `<table:table-cell table:style-name="Default" table:number-columns-repeated="${colsTotal - 11}"/>`
      : `<table:table-cell/>`) +
    `</table:table-row>`;

  return titulo + metricas + espaco;
}

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
  geral: string;
  rubricaSvg?: string;
  rubricaPictureName?: string;
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
  rubricaSvg?: string;
  rubricaPictureName?: string;
};

export type OdsPicture = {
  path: string;
  data: Uint8Array;
};

function situacaoDeNota(nota: string | undefined): 'aprovado' | 'reprovado' | null {
  const n = (nota || '').trim();
  if (!n || n === '—') return null;
  if (n.toUpperCase() === 'REPROVADO') return 'reprovado';
  return 'aprovado';
}

export function situacaoPermanencia(c: CadastroItemPersist): string {
  if (c.resultadoPermanencia === 'aprovado') return 'APROVADO';
  if (c.resultadoPermanencia === 'reprovado') return 'REPROVADO';
  return '';
}

/**
 * Só APROVADO/REPROVADO com TAF completo (corrida/caminhada + natação + permanência).
 * Caso contrário: TESTE PENDENTE.
 */
export function situacaoGeralPlanilha(c: CadastroItemPersist): string {
  if (!cadastroComTafCompleto(c)) return 'TESTE PENDENTE';

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

  if (resultados.some((r) => r === 'reprovado')) return 'REPROVADO';
  return 'APROVADO';
}

/** Rúbrica SVG do primeiro teste (pela data de aplicação; desempate por ordem de modalidade). */
export function primeiraRubricaSvgDoCadastro(c: CadastroItemPersist): string | undefined {
  type Entry = { iso: string; tie: number; svg: string };
  const entries: Entry[] = [];

  const push = (dataBr: string | undefined, svg: string | undefined, tie: number) => {
    const normalized = normalizarRubricaSvgDataUrl(svg);
    if (!normalized) return;
    const iso = dataBrParaIso(dataBr || '') || `9999-99-99-${tie}`;
    entries.push({ iso, tie, svg: normalized });
  };

  push(c.dataTafCorrida, c.rubricaCorridaSvg, 1);
  push(c.dataTafCaminhada, c.rubricaCaminhadaSvg, 2);
  push(c.dataTafNatacao, c.rubricaNatacaoSvg, 3);
  push(c.dataTafPermanencia, c.rubricaPermanenciaSvg, 4);

  if (entries.length === 0) return undefined;
  entries.sort((a, b) => a.iso.localeCompare(b.iso) || a.tie - b.tie);
  return entries[0]?.svg;
}

export function svgDataUrlParaXml(svgDataUrl: string): string | null {
  const raw = normalizarRubricaSvgDataUrl(svgDataUrl)?.trim();
  if (!raw?.startsWith('data:image/svg')) return null;

  const b64 = /^data:image\/svg\+xml;base64,(.+)$/i.exec(raw);
  if (b64?.[1]) {
    try {
      if (typeof atob !== 'function') return null;
      return atob(b64[1]);
    } catch {
      return null;
    }
  }

  const comma = raw.indexOf(',');
  if (comma < 0) return null;
  try {
    return decodeURIComponent(raw.slice(comma + 1));
  } catch {
    return null;
  }
}

export function estiloPontos(nota: string): string {
  const n = nota.trim();
  if (!n) return 'ce9';
  if (n.toUpperCase() === 'REPROVADO') return 'cePontosVermelho';
  const num = Number.parseFloat(n.replace(',', '.'));
  if (!Number.isFinite(num)) return 'ce9';
  return num < 50 ? 'cePontosVermelho' : 'cePontosVerde';
}

export function estiloPermanencia(valor: string): string {
  const v = valor.trim().toUpperCase();
  if (v === 'APROVADO') return 'cePermAprovado';
  if (v === 'REPROVADO') return 'cePermReprovado';
  return 'ce9';
}

export function estiloGeral(valor: string): string {
  const v = valor.trim().toUpperCase();
  if (v === 'TESTE PENDENTE') return 'ceTestePendente';
  if (v === 'APROVADO') return 'ceGeralAprovado';
  if (v === 'REPROVADO') return 'ceGeralReprovado';
  return 'ce25';
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

function rubricaCell(pictureName: string | undefined, _baseStyle: string): string {
  if (!pictureName) {
    return `<table:table-cell table:style-name="ceRubrica"/>`;
  }
  // Mesmo layout da planilha de referência (Atualizada.ods).
  return (
    `<table:table-cell table:style-name="ceRubrica">` +
    `<draw:frame draw:style-name="grRubrica" draw:name="${escapeXml(pictureName)}" ` +
    `svg:x="0.05906in" svg:y="0.01969in" svg:width="1.02362in" svg:height="0.37402in" draw:z-index="1" ` +
    `style:rel-width="scale" style:rel-height="scale">` +
    `<draw:image xlink:href="media/${escapeXml(pictureName)}" xlink:type="simple" ` +
    `xlink:show="embed" xlink:actuate="onLoad"/>` +
    `</draw:frame>` +
    `</table:table-cell>`
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

function registrarRubrica(
  pictures: OdsPicture[],
  prefix: string,
  index: number,
  svgDataUrl: string | undefined,
): string | undefined {
  if (!svgDataUrl) return undefined;
  const xml = svgDataUrlParaXml(svgDataUrl);
  if (!xml) return undefined;
  const name = `${prefix}_${index}.svg`;
  const bytes = utf8Bytes(xml);
  // Pasta media/ (como no ODS de referência) — LibreOffice e Excel exibem melhor.
  pictures.push({ path: `media/${name}`, data: bytes });
  return name;
}

/** Monta mapa NIP → rúbricas a partir das sessões do Histórico. */
export function rubricasPorNipDasSessoes(sessoes: SessaoAplicacaoTaf[]): Map<string, RubricasPorNip> {
  const map = new Map<string, RubricasPorNip>();
  for (const sessao of sessoes) {
    for (const r of sessao.resultados ?? []) {
      const svg = r.rubricaCandidatoSvg?.trim();
      if (!svg) continue;
      const key = nipDigitos(r.nip);
      if (!key) continue;
      const prova = r.prova ?? sessao.tipoProva;
      const atual = map.get(key) ?? {};
      if (prova === 'natacao') atual.natacao = svg;
      else if (prova === 'permanencia') atual.permanencia = svg;
      else if (prova === 'caminhada') atual.caminhada = svg;
      else atual.corrida = svg;
      map.set(key, atual);
    }
  }
  return map;
}

/** Completa rúbricas do cadastro com as das sessões quando faltarem no cadastro. */
export function enriquecerCadastrosComRubricasDasSessoes(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[],
): CadastroItemPersist[] {
  if (!sessoes.length) return cadastros;
  const porNip = rubricasPorNipDasSessoes(sessoes);
  return cadastros.map((c) => {
    const key = nipDigitos(c.nip);
    const daSessao = key ? porNip.get(key) : undefined;
    if (!daSessao) return c;
    const doCadastro = rubricasDoCadastro(c);
    const pick = (a?: string, b?: string) => (a?.trim() ? a : b?.trim() ? b : a);
    return {
      ...c,
      rubricaCorridaSvg: pick(doCadastro.corrida, daSessao.corrida) || c.rubricaCorridaSvg,
      rubricaCaminhadaSvg: pick(doCadastro.caminhada, daSessao.caminhada) || c.rubricaCaminhadaSvg,
      rubricaNatacaoSvg: pick(doCadastro.natacao, daSessao.natacao) || c.rubricaNatacaoSvg,
      rubricaPermanenciaSvg: pick(doCadastro.permanencia, daSessao.permanencia) || c.rubricaPermanenciaSvg,
    };
  });
}

export function montarLinhasArmada(
  cadastros: CadastroItemPersist[],
  pictures: OdsPicture[] = [],
  picturePrefix = 'rubrica_a',
): LinhaPlanilhaArmada[] {
  return filtrarCadastrosComTeste(cadastros)
    .sort(compareByNomePtBr)
    .map((c, index) => {
      const idade = idadeFromDataNascimento(c.dataNascimento);
      const pg = postoGradFromCadastro(c);
      const rubricaSvg = primeiraRubricaSvgDoCadastro(c);
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
        geral: situacaoGeralPlanilha(c),
        rubricaSvg,
        rubricaPictureName: registrarRubrica(pictures, picturePrefix, index, rubricaSvg),
      };
    });
}

export function montarLinhasFn(
  cadastros: CadastroItemPersist[],
  pictures: OdsPicture[] = [],
  picturePrefix = 'rubrica_fn',
): LinhaPlanilhaFn[] {
  return filtrarCadastrosComTeste(cadastros)
    .sort(compareByNomePtBr)
    .map((c, index) => {
      const idade = idadeFromDataNascimento(c.dataNascimento);
      const pg = postoGradFromCadastro(c);
      const abdominal =
        c.repsAbdominalRemador != null
          ? String(c.repsAbdominalRemador)
          : (c.tempoAbdominalPrancha || '').trim();
      const abdominalPontos = (c.notaAbdominalRemador || c.notaAbdominalPrancha || '').trim();
      const flexaoPontos = (c.notaFlexaoBarra || c.notaFlexaoSolo || '').trim();
      const rubricaSvg = primeiraRubricaSvgDoCadastro(c);

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
        geral: situacaoGeralPlanilha(c),
        rubricaSvg,
        rubricaPictureName: registrarRubrica(pictures, picturePrefix, index, rubricaSvg),
      };
    });
}

function rowArmadaXml(row: LinhaPlanilhaArmada): string {
  const s = 'ce9';
  const rowStyle = row.rubricaPictureName ? 'roRubrica' : 'ro3';
  return (
    `<table:table-row table:style-name="${rowStyle}">` +
    dataCell(row.pg, s) +
    dataCell(row.nip, s) +
    dataCell(row.nome, s) +
    dataCell(row.idade, s) +
    dataCell(row.corridaTempo, s) +
    dataCell(row.corridaPontos, estiloPontos(row.corridaPontos)) +
    dataCell(row.natacaoTempo, s) +
    dataCell(row.natacaoPontos, estiloPontos(row.natacaoPontos)) +
    dataCell(row.permanencia, estiloPermanencia(row.permanencia)) +
    dataCell(row.geral, estiloGeral(row.geral)) +
    rubricaCell(row.rubricaPictureName, s) +
    `</table:table-row>`
  );
}

function rowFnXml(row: LinhaPlanilhaFn): string {
  const s = 'ce36';
  const rowStyle = row.rubricaPictureName ? 'roRubrica' : 'ro3';
  return (
    `<table:table-row table:style-name="${rowStyle}">` +
    dataCell(row.pg, s) +
    dataCell(row.nip, s) +
    dataCell(row.nome, s) +
    dataCell(row.idade, s) +
    dataCell(row.permanencia, estiloPermanencia(row.permanencia)) +
    dataCell(row.permanenciaPontos, estiloPontos(row.permanenciaPontos)) +
    dataCell(row.natacaoTempo, s) +
    dataCell(row.natacaoPontos, estiloPontos(row.natacaoPontos)) +
    dataCell(row.flexaoBarra, s) +
    dataCell(row.flexaoSolo, s) +
    dataCell(row.flexaoPontos, estiloPontos(row.flexaoPontos)) +
    dataCell(row.abdominal, s) +
    dataCell(row.abdominalPontos, estiloPontos(row.abdominalPontos)) +
    dataCell(row.corrida, s) +
    dataCell(row.corridaPontos, estiloPontos(row.corridaPontos)) +
    dataCell(row.geral, estiloGeral(row.geral)) +
    rubricaCell(row.rubricaPictureName, s) +
    `</table:table-row>`
  );
}

function linhaVaziaArmada(): string {
  return (
    `<table:table-row table:style-name="ro3">` +
    `<table:table-cell table:style-name="ce9" table:number-columns-repeated="9"/>` +
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

function injetarEstilos(xml: string): string {
  if (xml.includes('style:name="ceTestePendente"')) return xml;
  return xml.replace('</office:automatic-styles>', `${ESTILOS_EXTRA}</office:automatic-styles>`);
}

/**
 * Larguras da planilha "Planilha TAF apptaf Real.ods".
 * Armada: 11 cols (co1–co10, sem nota de permanência). FN: co12–co21.
 */
export const LARGURAS_COLUNAS_REFERENCIA_CM: Record<string, string> = {
  co1: '5.08cm',
  co2: '3.22791666666667cm',
  co3: '9.04875cm',
  co4: '1.71979166666667cm',
  co5: '3.59833333333333cm',
  co6: '3.12208333333333cm',
  co7: '3.46604166666667cm',
  co8: '5.50333333333333cm',
  co9: '5.76791666666667cm',
  co10: '2.88395833333333cm',
  co11: '1.69333333333333cm',
  co12: '1.21708333333333cm',
  co13: '1.16416666666667cm',
  co14: '3.91583333333333cm',
  co15: '3.730625cm',
  co16: '2.38125cm',
  co17: '1.87854166666667cm',
  co18: '1.5875cm',
  co19: '2.40770833333333cm',
  co20: '3.30729166666667cm',
  co21: '3.33375cm',
};

const COLUNAS_ARMADA_MODELO =
  `<table:table-column table:style-name="co1" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co2" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co3" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co4" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co5" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co6" table:number-columns-repeated="2" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co7" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co8" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co9" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co10" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co11" table:default-cell-style-name="Default"/>`;

/** Armada Real.ods: 11 colunas (sem nota de permanência). */
const COLUNAS_ARMADA_REFERENCIA =
  `<table:table-column table:style-name="co1" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co2" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co3" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co4" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co5" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co6" table:number-columns-repeated="2" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co7" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co8" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co9" table:default-cell-style-name="ce9"/>` +
  `<table:table-column table:style-name="co10" table:default-cell-style-name="Default"/>`;

const COLUNAS_FN_MODELO =
  `<table:table-column table:style-name="co12" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co13" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co14" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co4" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co15" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co16" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co6" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co7" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co17" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co18" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co9" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co19" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co11" table:number-columns-repeated="3" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co20" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co11" table:default-cell-style-name="ce33"/>`;

/** FN Real.ods (preserva default-cell-style do modelo). */
const COLUNAS_FN_REFERENCIA =
  `<table:table-column table:style-name="co12" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co13" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co14" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co4" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co15" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co16" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co6" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co7" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co17" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co18" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co19" table:default-cell-style-name="ce36"/>` +
  `<table:table-column table:style-name="co20" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co10" table:number-columns-repeated="3" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co21" table:default-cell-style-name="ce32"/>` +
  `<table:table-column table:style-name="co10" table:default-cell-style-name="ce33"/>`;

function estiloColunaXml(name: string, width: string): string {
  return (
    `<style:style style:name="${name}" style:family="table-column">` +
    `<style:table-column-properties fo:break-before="auto" style:column-width="${width}"/>` +
    `</style:style>`
  );
}

/** Célula de cabeçalho "PONTOS" logo após PERMANÊNCIA (Armada) — removida na Real.ods. */
const CABECALHO_PONTOS_PERM_ARMADA =
  `<table:table-cell table:style-name="ce22" office:value-type="string" calcext:value-type="string">` +
  `<text:p>PONTOS</text:p></table:table-cell>`;

/**
 * Alinha colunas Armada/FN e remove a nota de permanência da Armada (Real.ods).
 */
export function normalizarEstruturaColunasReferencia(xml: string): string {
  let out = xml;
  if (!out.includes(COLUNAS_ARMADA_MODELO)) {
    throw new Error('Modelo ODS Armada inválido: definição de colunas não encontrada.');
  }
  if (!out.includes(COLUNAS_FN_MODELO)) {
    throw new Error('Modelo ODS FN inválido: definição de colunas não encontrada.');
  }
  out = out.replace(COLUNAS_ARMADA_MODELO, COLUNAS_ARMADA_REFERENCIA);
  out = out.replace(COLUNAS_FN_MODELO, COLUNAS_FN_REFERENCIA);

  if (!out.includes(BLOCO_VAZIO_ARMADA_MODELO)) {
    throw new Error('Modelo ODS Armada inválido: bloco vazio não encontrado.');
  }
  out = out.replace(BLOCO_VAZIO_ARMADA_MODELO, BLOCO_VAZIO_ARMADA);

  // Remove só o 1º "PONTOS" após PERMANÊNCIA na Armada (aba antes de FN).
  const fnMark = 'table:name="FN"';
  const fnIdx = out.indexOf(fnMark);
  if (fnIdx > 0) {
    const armada = out.slice(0, fnIdx);
    const rest = out.slice(fnIdx);
    const permIdx = armada.indexOf('>PERMANÊNCIA</text:p>');
    if (permIdx >= 0) {
      const pontosIdx = armada.indexOf(CABECALHO_PONTOS_PERM_ARMADA, permIdx);
      if (pontosIdx >= 0) {
        out =
          armada.slice(0, pontosIdx) +
          armada.slice(pontosIdx + CABECALHO_PONTOS_PERM_ARMADA.length) +
          rest;
      }
    }
  }

  const extras: string[] = [];
  for (const name of ['co21'] as const) {
    if (!out.includes(`style:name="${name}" style:family="table-column"`)) {
      extras.push(estiloColunaXml(name, LARGURAS_COLUNAS_REFERENCIA_CM[name]));
    }
  }
  if (extras.length) {
    out = out.replace('</office:automatic-styles>', `${extras.join('')}</office:automatic-styles>`);
  }

  return out;
}

/** Aplica as larguras da planilha Real.ods. */
export function ajustarLargurasColunasComFolga(xml: string): string {
  let out = xml;
  for (const [styleName, width] of Object.entries(LARGURAS_COLUNAS_REFERENCIA_CM)) {
    const re = new RegExp(
      `(style:name="${styleName}" style:family="table-column">` +
        `<style:table-column-properties[^>]*style:column-width=")([^"]+)(")`,
      'i',
    );
    if (re.test(out)) {
      out = out.replace(re, `$1${width}$3`);
    } else if (!out.includes(`style:name="${styleName}" style:family="table-column"`)) {
      out = out.replace(
        '</office:automatic-styles>',
        `${estiloColunaXml(styleName, width)}</office:automatic-styles>`,
      );
    }
  }
  return out;
}

export type PlanilhaTafBuild = {
  contentXml: string;
  pictures: OdsPicture[];
};

/** Injeta cadastros no content.xml do modelo HNMD TAF 2026. */
export function buildPlanilhaTafPackage(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): PlanilhaTafBuild {
  const ano = String(new Date().getFullYear());
  let xml = PLANILHA_TAF_MODELO_CONTENT_XML.replace(
    /TESTE DE APTIDÃO FÍSICA \(TAF\) 2026/g,
    `TESTE DE APTIDÃO FÍSICA (TAF) ${ano}`,
  );
  xml = injetarEstilos(xml);
  xml = normalizarEstruturaColunasReferencia(xml);

  const balanco = calcularBalancoPlanilhaTaf(cadastros);
  if (!xml.includes(BLOCO_ESPACO_TITULO_ARMADA)) {
    throw new Error('Modelo ODS Armada inválido: espaço sob o título não encontrado.');
  }
  if (!xml.includes(BLOCO_ESPACO_TITULO_FN)) {
    throw new Error('Modelo ODS FN inválido: espaço sob o título não encontrado.');
  }
  xml = xml.replace(BLOCO_ESPACO_TITULO_ARMADA, buildBalancoXml(balanco, 11));
  xml = xml.replace(BLOCO_ESPACO_TITULO_FN, buildBalancoXml(balanco, 17));

  const comRubricas = enriquecerCadastrosComRubricasDasSessoes(cadastros, sessoes);
  const pictures: OdsPicture[] = [];
  const armada = montarLinhasArmada(comRubricas, pictures, 'rubrica_a');
  const fn = montarLinhasFn(comRubricas, pictures, 'rubrica_fn');

  if (!xml.includes(BLOCO_VAZIO_ARMADA)) {
    throw new Error('Modelo ODS Armada inválido: bloco de linhas não encontrado.');
  }
  if (!xml.includes(BLOCO_VAZIO_FN)) {
    throw new Error('Modelo ODS FN inválido: bloco de linhas não encontrado.');
  }

  xml = xml.replace(BLOCO_VAZIO_ARMADA, preencherBlocoArmada(armada));
  xml = xml.replace(BLOCO_VAZIO_FN, preencherBlocoFn(fn));
  xml = ajustarLargurasColunasComFolga(xml);
  return { contentXml: xml, pictures };
}

/** Compat: só o XML (sem imagens embutidas no retorno). */
export function buildPlanilhaTafContentXml(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): string {
  return buildPlanilhaTafPackage(cadastros, sessoes).contentXml;
}

function buildManifestComPictures(pictures: OdsPicture[]): string {
  const base = PLANILHA_TAF_MODELO_MANIFEST_XML.replace(/\s*<\/manifest:manifest>\s*$/, '');
  const extras = pictures
    .map(
      (p) =>
        ` <manifest:file-entry manifest:full-path="${escapeXml(p.path)}" manifest:media-type="image/svg+xml"/>`,
    )
    .join('\n');
  return `${base}\n${extras}\n</manifest:manifest>\n`;
}

/** Gera bytes do arquivo ODS no formato da planilha HNMD anexada. */
export function buildBackupOdsBytes(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): Uint8Array {
  const { contentXml, pictures } = buildPlanilhaTafPackage(cadastros, sessoes);

  const entries: ZipStoreEntry[] = [
    { name: 'mimetype', data: utf8Bytes(PLANILHA_TAF_MODELO_MIMETYPE.trim()) },
    { name: 'content.xml', data: utf8Bytes(contentXml) },
    { name: 'styles.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_STYLES_XML) },
    { name: 'meta.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_META_XML) },
    { name: 'settings.xml', data: utf8Bytes(PLANILHA_TAF_MODELO_SETTINGS_XML) },
    { name: 'META-INF/manifest.xml', data: utf8Bytes(buildManifestComPictures(pictures)) },
  ];

  for (const pic of pictures) {
    entries.push({ name: pic.path, data: pic.data });
  }

  return buildZipStoreOnly(entries);
}

export function buildBackupOdsBlob(
  cadastros: CadastroItemPersist[],
  sessoes: SessaoAplicacaoTaf[] = [],
): Blob {
  const bytes = buildBackupOdsBytes(cadastros, sessoes);
  return new Blob([bytes], { type: ODS_MIME });
}

export const ODS_MIME_TYPE = ODS_MIME;
