export type NormasTableRow = {
  idade: string;
  valores: string[];
};

export type NormasTable = {
  id: string;
  /** Caminho hierárquico (ex.: 5.5.1 > a) Natação > I) Masculino) */
  path: string[];
  caption?: string;
  columns: string[];
  rows: NormasTableRow[];
};

export type NormasNote = {
  id: string;
  path: string[];
  text: string;
};

export type ParsedNormasDocument = {
  title: string;
  tables: NormasTable[];
  notes: NormasNote[];
};

const POINT_COUNT = 6;
const DEFAULT_COLUMNS = ['Idade', '50', '60', '70', '80', '90', '100'];

function isOstensivoLine(line: string): boolean {
  return /^OSTENSIVO/i.test(line.trim());
}

function isPontosLine(line: string): boolean {
  return line.trim() === 'PONTOS';
}

function isTableHeaderLine(line: string): boolean {
  return /^IDADE\s/i.test(line.trim());
}

function parseTableHeader(line: string): string[] {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0]?.toUpperCase() === 'IDADE') {
    return ['Idade', ...tokens.slice(1)];
  }
  return DEFAULT_COLUMNS;
}

/** Faixa etária válida nas tabelas CGCFN-108 (evita engolir texto da permanência). */
function isAgeIdade(idade: string): boolean {
  const t = idade.trim();
  if (/permanência|flutuando|pontos\s+para|dentro\s+da\s+água/i.test(t)) return false;
  if (/^\d+\s+a\s+\d+/.test(t)) return true;
  if (/^>\s*(de\s+)?\d+/.test(t)) return true;
  return false;
}

function parseTableRow(line: string): NormasTableRow | null {
  const trimmed = line.trim();
  if (!trimmed || isOstensivoLine(trimmed) || isPontosLine(trimmed) || isTableHeaderLine(trimmed)) {
    return null;
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length < POINT_COUNT + 1) return null;

  const valores = tokens.slice(-POINT_COUNT);
  const idade = tokens.slice(0, -POINT_COUNT).join(' ');
  if (!isAgeIdade(idade)) return null;

  return { idade, valores };
}

function isStructuralLine(line: string): boolean {
  return (
    headingLevel(line) != null ||
    isPontosLine(line) ||
    isTableHeaderLine(line) ||
    parseTableRow(line) != null ||
    line.startsWith('Tabela com') ||
    line.includes('tabela com') ||
    line.startsWith('Obs:')
  );
}

function skipDescriptionContinuation(lines: string[], startIndex: number): number {
  let i = startIndex;
  while (i < lines.length && !isStructuralLine(lines[i])) {
    i += 1;
  }
  return i;
}

function headingLevel(line: string): number | null {
  const t = line.trim();
  if (/^\d+\.\d+\.\d+\./.test(t)) return 3;
  if (/^\d+\.\d+\./.test(t)) return 2;
  if (/^\d+\.\d+\s/.test(t)) return 1;
  /** Letras a–z) antes de romanos — evita "a)" ser confundido com romano (flag /i). */
  if (/^[a-z]\)/.test(t)) return 4;
  if (/^[IVX]+\)/.test(t)) return 5;
  return null;
}

type HeadingStackItem = { level: number; title: string };

function pushHeading(stack: HeadingStackItem[], level: number, title: string): string[] {
  while (stack.length > 0 && stack[stack.length - 1].level >= level) {
    stack.pop();
  }
  stack.push({ level, title });
  return stack.map((s) => s.title);
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

/**
 * Converte o texto bruto CGCFN-108 em tabelas estruturadas + notas explicativas.
 */
export function parseNormasCgcfn108(raw: string): ParsedNormasDocument {
  idCounter = 0;
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isOstensivoLine(l));

  const tables: NormasTable[] = [];
  const notes: NormasNote[] = [];

  const headingStack: HeadingStackItem[] = [];
  let path: string[] = [];
  let documentTitle = 'CGCFN-108';
  let pendingCaption: string | undefined;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const level = headingLevel(line);

    if (level != null) {
      path = pushHeading(headingStack, level, line);
      if (level <= 2 && line.includes('PONTUAÇÃO')) {
        documentTitle = line;
      }
      pendingCaption = undefined;
      i += 1;
      i = skipDescriptionContinuation(lines, i);
      continue;
    }

    if (isPontosLine(line)) {
      i += 1;
      if (i >= lines.length || !isTableHeaderLine(lines[i])) continue;

      const columns = parseTableHeader(lines[i]);
      i += 1;
      const rows: NormasTableRow[] = [];

      while (i < lines.length) {
        const row = parseTableRow(lines[i]);
        if (!row) break;
        rows.push(row);
        i += 1;
      }

      if (rows.length > 0) {
        tables.push({
          id: nextId('tbl'),
          path: [...path],
          caption: pendingCaption,
          columns,
          rows,
        });
        pendingCaption = undefined;
      }
      continue;
    }

    if (isTableHeaderLine(line)) {
      const columns = parseTableHeader(line);
      i += 1;
      const rows: NormasTableRow[] = [];
      while (i < lines.length) {
        const row = parseTableRow(lines[i]);
        if (!row) break;
        rows.push(row);
        i += 1;
      }
      if (rows.length > 0) {
        tables.push({
          id: nextId('tbl'),
          path: [...path],
          caption: pendingCaption,
          columns,
          rows,
        });
        pendingCaption = undefined;
      }
      continue;
    }

    const maybeRow = parseTableRow(line);
    if (maybeRow) {
      i += 1;
      continue;
    }

    if (line.startsWith('Tabela com') || line.includes('tabela com')) {
      pendingCaption = line;
    } else if (line.startsWith('Obs:')) {
      notes.push({
        id: nextId('note'),
        path: [...path],
        text: line,
      });
    }

    i += 1;
  }

  const titleLine = lines.find((l) => l.includes('PONTUAÇÃO')) ?? lines[0];
  if (titleLine) documentTitle = titleLine;

  return { title: documentTitle, tables, notes };
}

export function formatNormasPath(path: string[]): string {
  return path.filter(Boolean).join(' › ');
}

/** Apenas observações curtas (ex.: unidade em minutos) aparecem como card. */
export function isDisplayableNormasNote(note: NormasNote): boolean {
  return note.text.trim().startsWith('Obs:');
}

export function normasTableMatchesQuery(table: NormasTable, q: string): boolean {
  const lower = q.toLowerCase();
  if (formatNormasPath(table.path).toLowerCase().includes(lower)) return true;
  if (table.caption?.toLowerCase().includes(lower)) return true;
  return table.rows.some(
    (r) =>
      r.idade.toLowerCase().includes(lower) ||
      r.valores.some((v) => v.toLowerCase().includes(lower)),
  );
}
