import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { formatNipInput } from './nipFormat';
import { agruparItensPdfEmLinhas, type PdfTextItem } from './pdfTextLayout';

export type LinhaRelacaoCadastro = {
  posto: string;
  nip: string;
  nome: string;
  dataNascimento?: string;
};

const POSTOS_CONHECIDOS =
  'GM|2°?TEN|1°?TEN|CT|CC|CF|CMG|CALTE|MN|MNRC|CB|3°?SG|2°?SG|1°?SG|SO|GR';

const POSTO_OFICIAIS = new Set([
  'GM',
  '2°TEN',
  '1°TEN',
  'CT',
  'CC',
  'CF',
  'CMG',
  'CALTE',
]);

const POSTO_PRACAS = new Set(['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO']);

const POSTO_ALIASES: Record<string, string> = {
  '1TEN': '1°TEN',
  '2TEN': '2°TEN',
  '1SG': '1°SG',
  '2SG': '2°SG',
  '3SG': '3°SG',
  MNRC: 'MN',
  GR: 'MN',
};

export function normalizarPostoGraduacao(postoRaw: string): string {
  const limpo = postoRaw.trim().toUpperCase().replace(/\s+/g, '');
  return POSTO_ALIASES[limpo] ?? limpo;
}

export function categoriaFromPosto(postoRaw: string): 'Oficiais' | 'Praças' {
  const posto = normalizarPostoGraduacao(postoRaw);
  if (POSTO_OFICIAIS.has(posto)) return 'Oficiais';
  if (POSTO_PRACAS.has(posto)) return 'Praças';
  return 'Praças';
}

function extrairDataNascimentoDoTexto(texto: string): { nome: string; dataNascimento: string } {
  const match = texto.match(/\b(\d{2}\/\d{2}\/\d{4})\s*$/);
  if (!match) return { nome: texto.trim(), dataNascimento: '' };
  const dataNascimento = match[1];
  const nome = texto.slice(0, match.index).trim();
  return { nome, dataNascimento };
}

const LINHA_REGISTRO_COM_SEQ_RE = new RegExp(
  `^(\\d{1,5})\\s+(${POSTOS_CONHECIDOS})\\s+(\\d{4,9})\\s*(.*)$`,
  'i',
);

const LINHA_REGISTRO_SEM_SEQ_RE = new RegExp(
  `^(${POSTOS_CONHECIDOS})\\s+(\\d{4,9})\\s*(.+)$`,
  'i',
);

const LINHA_REGISTRO_SEM_NIP_RE = new RegExp(
  `^(\\d{1,5})\\s+(${POSTOS_CONHECIDOS})\\s+(.+)$`,
  'i',
);

const LINHA_IGNORAR_RE =
  /^(planilha|posto|gradu|ação|nip|militar|página|relação|nome|cadastro|sistaf|--|\d+\s+of\s+\d+|\d+\s+de\s+\d+)$/i;

const GLOBAL_REGISTRO_RE = new RegExp(
  `(\\d{1,5})\\s+(${POSTOS_CONHECIDOS})\\s+(\\d{4,9})\\s+`,
  'gi',
);

function linhaDeveIgnorar(linha: string): boolean {
  const t = linha.trim();
  if (!t || t.length < 4) return true;
  if (LINHA_IGNORAR_RE.test(t)) return true;
  if (/^[\d\s./-]+$/.test(t)) return true;
  return false;
}

function criarRegistro(
  posto: string,
  nip: string,
  nomeBruto: string,
): LinhaRelacaoCadastro | null {
  const { nome, dataNascimento } = extrairDataNascimentoDoTexto(nomeBruto);
  const nomeLimpo = nome.trim();
  const nipDigitos = nip.replace(/\D/g, '');
  if (!nomeLimpo || nipDigitos.length < 4) return null;
  return {
    posto: posto.trim(),
    nip: nip.trim(),
    nome: nomeLimpo,
    dataNascimento: dataNascimento || undefined,
  };
}

function parsePorLinhas(texto: string): LinhaRelacaoCadastro[] {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const registros: LinhaRelacaoCadastro[] = [];
  let pendente: LinhaRelacaoCadastro | null = null;

  for (const linha of linhas) {
    if (linhaDeveIgnorar(linha)) continue;

    let match = linha.match(LINHA_REGISTRO_COM_SEQ_RE);
    if (match) {
      if (pendente) {
        const fechado = criarRegistro(pendente.posto, pendente.nip, pendente.nome);
        if (fechado) registros.push(fechado);
      }
      const resto = (match[4] || '').trim();
      pendente = {
        posto: match[2],
        nip: match[3],
        nome: resto,
        dataNascimento: extrairDataNascimentoDoTexto(resto).dataNascimento || undefined,
      };
      continue;
    }

    match = linha.match(LINHA_REGISTRO_SEM_SEQ_RE);
    if (match) {
      if (pendente) {
        const fechado = criarRegistro(pendente.posto, pendente.nip, pendente.nome);
        if (fechado) registros.push(fechado);
      }
      const resto = (match[3] || '').trim();
      pendente = {
        posto: match[1],
        nip: match[2],
        nome: resto,
        dataNascimento: extrairDataNascimentoDoTexto(resto).dataNascimento || undefined,
      };
      continue;
    }

    match = linha.match(LINHA_REGISTRO_SEM_NIP_RE);
    if (match) {
      const possivelNome = (match[3] || '').trim();
      const possivelNip = possivelNome.match(/^(\d{4,9})\s+(.+)$/);
      if (possivelNip) {
        if (pendente) {
          const fechado = criarRegistro(pendente.posto, pendente.nip, pendente.nome);
          if (fechado) registros.push(fechado);
        }
        pendente = {
          posto: match[2],
          nip: possivelNip[1],
          nome: possivelNip[2],
        };
        continue;
      }
    }

    if (pendente && !new RegExp(`^\\d{1,5}\\s+${POSTOS_CONHECIDOS}`, 'i').test(linha)) {
      const textoNome = pendente.nome ? `${pendente.nome} ${linha}` : linha;
      const { nome, dataNascimento } = extrairDataNascimentoDoTexto(textoNome);
      pendente.nome = nome;
      if (dataNascimento) pendente.dataNascimento = dataNascimento;
    }
  }

  if (pendente) {
    const fechado = criarRegistro(pendente.posto, pendente.nip, pendente.nome);
    if (fechado) registros.push(fechado);
  }
  return registros;
}

function parsePorRegexGlobal(texto: string): LinhaRelacaoCadastro[] {
  const flat = texto.replace(/\s+/g, ' ').trim();
  if (!flat) return [];

  const registros: LinhaRelacaoCadastro[] = [];
  const matches = [...flat.matchAll(GLOBAL_REGISTRO_RE)];
  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i += 1) {
    const m = matches[i];
    const inicioNome = (m.index ?? 0) + m[0].length;
    const fimNome = i + 1 < matches.length ? (matches[i + 1].index ?? flat.length) : flat.length;
    const nomeBruto = flat.slice(inicioNome, fimNome).trim();
    const reg = criarRegistro(m[2], m[3], nomeBruto);
    if (reg) registros.push(reg);
  }

  return registros;
}

/** NIP no formato 00.0000.00 (relação HNMD / oficiais). */
const NIP_FORMATADO_RE = /^\d{2}\.\d{4}\.\d{2}$/;

const LINHA_HNMD_IGNORAR_RE =
  /^(oficiais|praças|pracas|página|pagina|relação|relacao|nome|nip|categoria|posto|graduação|graduacao)$/i;

function linhaHnmdDeTokens(tokens: PdfTextItem[]): LinhaRelacaoCadastro | null {
  if (tokens.length < 3) return null;

  const nipToken = tokens.find((t) => NIP_FORMATADO_RE.test(t.str.trim()));
  if (!nipToken) return null;

  const nomeToken = tokens[tokens.length - 1];
  const nome = nomeToken.str.trim();
  if (!nome || nome.length < 4 || !/[A-Za-zÀ-ú]/.test(nome)) return null;
  if (LINHA_HNMD_IGNORAR_RE.test(nome)) return null;

  const ordenados = [...tokens].sort((a, b) => a.x - b.x);
  const nipIdx = ordenados.findIndex((t) => t === nipToken);
  const postoToken = ordenados[nipIdx + 1];
  if (!postoToken) return null;

  const posto = postoToken.str.trim();
  if (!posto || NIP_FORMATADO_RE.test(posto) || LINHA_HNMD_IGNORAR_RE.test(posto)) return null;

  return criarRegistro(posto, nipToken.str.trim(), nome);
}

/**
 * Relação tabular HNMD: coluna 1 = NIP, coluna 2 = posto/graduação, última = nome.
 * Colunas intermediárias (corpo, arma etc.) são ignoradas.
 */
export function parseRelacaoHnmdPdfItems(items: PdfTextItem[]): LinhaRelacaoCadastro[] {
  if (!items.length) return [];

  const registros: LinhaRelacaoCadastro[] = [];
  const linhas = agruparItensPdfEmLinhas(items);

  for (const linha of linhas) {
    const reg = linhaHnmdDeTokens(linha);
    if (reg) registros.push(reg);
  }

  return registros;
}

function pareceFormatoHnmd(items: PdfTextItem[]): boolean {
  const linhas = agruparItensPdfEmLinhas(items);
  let comNip = 0;
  for (const linha of linhas) {
    if (linha.some((t) => NIP_FORMATADO_RE.test(t.str.trim()))) comNip += 1;
  }
  return comNip >= 3;
}

/**
 * Interpreta PDF de cadastro (HNMD tabular ou SISTAF legado).
 */
export function parseRelacaoCadastroPdf(
  entrada: string | { texto: string; items?: PdfTextItem[] },
): LinhaRelacaoCadastro[] {
  const texto = typeof entrada === 'string' ? entrada : entrada.texto;
  const items = typeof entrada === 'string' ? undefined : entrada.items;

  if (items?.length && pareceFormatoHnmd(items)) {
    const hnmd = parseRelacaoHnmdPdfItems(items);
    if (hnmd.length > 0) return hnmd;
  }

  return parseRelacaoCadastroPdfText(texto);
}

/**
 * Interpreta o texto extraído de PDFs no formato SISTAF (Posto/Grad, NIP, Militar).
 */
export function parseRelacaoCadastroPdfText(texto: string): LinhaRelacaoCadastro[] {
  const bruto = texto.replace(/\u00a0/g, ' ').trim();
  if (!bruto) return [];

  const porLinhas = parsePorLinhas(bruto);
  if (porLinhas.length > 0) return porLinhas;

  return parsePorRegexGlobal(bruto);
}

export function linhaRelacaoParaCadastro(
  linha: LinhaRelacaoCadastro,
  id?: string,
): CadastroItemPersist {
  const posto = normalizarPostoGraduacao(linha.posto);
  const categoria = categoriaFromPosto(linha.posto);
  const nip = formatNipInput(linha.nip).trim();
  const dataNascimento = (linha.dataNascimento || '').trim();

  const item: CadastroItemPersist = {
    id: id ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    nip,
    nome: linha.nome.trim(),
    dataNascimento,
    categoria,
    sexo: 'M',
  };

  if (categoria === 'Oficiais') item.oficial = posto;
  else item.praca = posto;

  return item;
}

export function linhasRelacaoParaCadastros(linhas: LinhaRelacaoCadastro[]): CadastroItemPersist[] {
  return linhas.map((l) => linhaRelacaoParaCadastro(l));
}

/** Útil para testes com itens posicionais do PDF.js. */
export function cadastrosFromPdfItems(items: PdfTextItem[]): CadastroItemPersist[] {
  return linhasRelacaoParaCadastros(parseRelacaoCadastroPdf({ texto: '', items }));
}
