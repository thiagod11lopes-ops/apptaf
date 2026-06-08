export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvEscape).join(',');
}

/** Parser CSV com suporte a campos entre aspas e quebras de linha. */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || (char === '\r' && next === '\n')) {
      row.push(field);
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        records.push(row);
      }
      row = [];
      if (char === '\r') i += 1;
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.length > 0)) {
      records.push(row);
    }
  }

  return records;
}

export function recordsToObjects<T extends Record<string, string>>(
  records: string[][],
): { headers: string[]; rows: T[] } {
  if (records.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = records[0]!.map((h) => h.trim());
  const rows = records.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = (cells[index] ?? '').trim();
    });
    return obj as T;
  });
  return { headers, rows };
}
