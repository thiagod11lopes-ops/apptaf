/**
 * Idade e faixa etária para aplicação das tabelas CGCFN-108.
 */

/** Faixas oficiais até 50 anos; idade &gt; 50 usa a tabela 46–50. */
export type FaixaEtariaCGCF =
  | '18-25'
  | '26-30'
  | '31-35'
  | '36-40'
  | '41-45'
  | '46-50';

/**
 * Converte string de tempo de prova em **segundos totais**.
 *
 * - **Dois segmentos (`MM:SS`)**: minutos e segundos (ex.: `05:03` → 303 s).
 * - **Três segmentos**:
 *   - `MM:SS:CS` (cronômetro atual; centésimos truncados) — ex.: `05:03:45` → 303 s
 *   - Legado `00:MM:SS` (hora zero) ou `HH:MM:SS`
 */
export function tempoStringParaSegundos(tempo: string): number | null {
  const t = tempo.trim();
  if (!t) return null;
  const partes = t.split(':').map((p) => p.replace(/\D/g, ''));
  if (partes.length === 2) {
    const minutos = parseInt(partes[0], 10);
    const segundos = parseInt(partes[1], 10);
    if (!Number.isFinite(minutos) || !Number.isFinite(segundos) || segundos > 59) return null;
    return minutos * 60 + segundos;
  }
  if (partes.length === 3) {
    const a = parseInt(partes[0], 10);
    const b = parseInt(partes[1], 10);
    const c = parseInt(partes[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
    // Legado 00:MM:SS
    if (a === 0 && b <= 59 && c <= 59) {
      return b * 60 + c;
    }
    // MM:SS:CS (padrão do cronômetro)
    if (b <= 59 && c <= 99) {
      return a * 60 + b;
    }
    // HH:MM:SS
    if (a < 24 && b <= 59 && c <= 59) {
      return a * 3600 + b * 60 + c;
    }
    return null;
  }
  return null;
}

/** Alias explícito: `MM:SS` = minutos + segundos → segundos totais. */
export const parseMinutosSegundosParaSegundos = tempoStringParaSegundos;

/**
 * Converte `MM:SS`, `MM:SS:CS` ou legado `HH:MM:SS` / `00:MM:SS` em milissegundos.
 */
export function tempoStringParaMsProva(tempo: string): number | null {
  const t = tempo.trim();
  if (!t) return null;
  const partes = t.split(':').map((p) => p.replace(/\D/g, ''));
  if (partes.length === 2) {
    const minutos = parseInt(partes[0], 10);
    const segundos = parseInt(partes[1], 10);
    if (!Number.isFinite(minutos) || !Number.isFinite(segundos) || segundos > 59) return null;
    return minutos * 60_000 + segundos * 1000;
  }
  if (partes.length === 3) {
    const a = parseInt(partes[0], 10);
    const b = parseInt(partes[1], 10);
    const c = parseInt(partes[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
    if (a === 0 && b <= 59 && c <= 59) {
      return b * 60_000 + c * 1000;
    }
    if (b <= 59 && c <= 99) {
      return a * 60_000 + b * 1000 + c * 10;
    }
    if (a < 24 && b <= 59 && c <= 59) {
      return a * 3_600_000 + b * 60_000 + c * 1000;
    }
    return null;
  }
  return null;
}

function parseDataBrasileira(dataNascimento: string): Date | null {
  const m = dataNascimento.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const y = parseInt(m[3], 10);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Idade completa em anos na data de referência (padrão: hoje).
 */
export function calcularIdadeAnos(dataNascimentoDdMmYyyy: string, refDate: Date = new Date()): number | null {
  const birth = parseDataBrasileira(dataNascimentoDdMmYyyy);
  if (!birth) return null;
  let age = refDate.getFullYear() - birth.getFullYear();
  const md = refDate.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && refDate.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Faixa etária usada nas tabelas deste módulo (alinhada à estrutura típica da norma).
 */
export function idadeParaFaixaEtariaCGCF(idade: number | null): FaixaEtariaCGCF | null {
  if (idade == null || idade < 18) return null;
  if (idade <= 25) return '18-25';
  if (idade <= 30) return '26-30';
  if (idade <= 35) return '31-35';
  if (idade <= 40) return '36-40';
  if (idade <= 45) return '41-45';
  return '46-50';
}
