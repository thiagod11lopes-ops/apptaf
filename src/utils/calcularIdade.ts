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
 * - **Dois segmentos (`MM:SS`)**: **minutos** e **segundos** (ex.: `05:03` → 5×60+3 = **303 s**).
 *   O primeiro grupo é sempre minutos (pode ser &gt; 59, ex.: `105:30`).
 * - **Três segmentos (`HH:MM:SS`)**: horas, minutos e segundos (ex.: `00:05:03` → 303 s).
 *
 * Para tempos &lt; 1 h também pode usar `00:MM:SS` com horas zero.
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
    const h = parseInt(partes[0], 10);
    const m = parseInt(partes[1], 10);
    const s = parseInt(partes[2], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s) || m > 59 || s > 59)
      return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/** Alias explícito: `MM:SS` = minutos + segundos → segundos totais. */
export const parseMinutosSegundosParaSegundos = tempoStringParaSegundos;

/**
 * Converte `MM:SS` ou `HH:MM:SS` em milissegundos (provas por tempo / cronômetro).
 */
export function tempoStringParaMsProva(tempo: string): number | null {
  const sec = tempoStringParaSegundos(tempo);
  if (sec == null) return null;
  return sec * 1000;
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
