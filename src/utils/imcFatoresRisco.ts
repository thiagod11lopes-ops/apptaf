/** Classificação e cores do IMC (kg/m²) para Fatores de Risco. */

export type ImcCor = 'azul' | 'laranja' | 'vermelho';

export type ImcClassificacaoId =
  | 'abaixo'
  | 'normal'
  | 'sobrepeso'
  | 'obesidade1'
  | 'obesidade2'
  | 'obesidade3';

export type ImcClassificacao = {
  id: ImcClassificacaoId;
  faixa: string;
  titulo: string;
  descricao: string;
  cor: ImcCor;
  /** Cor hexadecimal do resultado. */
  corHex: string;
};

export type ImcResultado = {
  imc: number;
  imcFormatado: string;
  classificacao: ImcClassificacao;
};

const CORES: Record<ImcCor, string> = {
  azul: '#2563eb',
  laranja: '#ea580c',
  vermelho: '#dc2626',
};

const CLASSIFICACOES: ReadonlyArray<ImcClassificacao & { min: number; max: number }> = [
  {
    id: 'abaixo',
    min: 0,
    max: 18.5,
    faixa: 'Abaixo de 18,5',
    titulo: 'Abaixo do peso',
    descricao: 'Peso inferior ao considerado ideal para a altura.',
    cor: 'azul',
    corHex: CORES.azul,
  },
  {
    id: 'normal',
    min: 18.5,
    max: 25,
    faixa: 'Entre 18,5 e 24,9',
    titulo: 'Peso normal',
    descricao: 'Faixa de peso considerada saudável, com menor risco de doenças.',
    cor: 'azul',
    corHex: CORES.azul,
  },
  {
    id: 'sobrepeso',
    min: 25,
    max: 30,
    faixa: 'Entre 25,0 e 29,9',
    titulo: 'Sobrepeso',
    descricao: 'Um estado pré-obesidade, indicando atenção física e nutricional.',
    cor: 'laranja',
    corHex: CORES.laranja,
  },
  {
    id: 'obesidade1',
    min: 30,
    max: 35,
    faixa: 'Entre 30,0 e 34,9',
    titulo: 'Obesidade Grau I',
    descricao: 'Início do aumento de riscos cardiovasculares e metabólicos.',
    cor: 'vermelho',
    corHex: CORES.vermelho,
  },
  {
    id: 'obesidade2',
    min: 35,
    max: 40,
    faixa: 'Entre 35,0 e 39,9',
    titulo: 'Obesidade Grau II',
    descricao: 'Risco moderado a alto para o desenvolvimento de comorbidades.',
    cor: 'vermelho',
    corHex: CORES.vermelho,
  },
  {
    id: 'obesidade3',
    min: 40,
    max: Number.POSITIVE_INFINITY,
    faixa: '40,0 ou mais',
    titulo: 'Obesidade Grau III',
    descricao: 'Antigamente chamada de obesidade mórbida; risco severo à saúde.',
    cor: 'vermelho',
    corHex: CORES.vermelho,
  },
];

/** Aceita vírgula ou ponto; retorna número ou null. */
export function parseNumeroBr(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Converte altura informada para metros.
 * Valores > 3 são tratados como centímetros (ex.: 175 → 1,75).
 */
export function alturaParaMetros(alturaInformada: number): number | null {
  if (!Number.isFinite(alturaInformada) || alturaInformada <= 0) return null;
  if (alturaInformada > 3) return alturaInformada / 100;
  return alturaInformada;
}

export function classificarImc(imc: number): ImcClassificacao {
  for (const c of CLASSIFICACOES) {
    if (imc >= c.min && imc < c.max) {
      const { min: _min, max: _max, ...rest } = c;
      return rest;
    }
  }
  const last = CLASSIFICACOES[CLASSIFICACOES.length - 1];
  const { min: _min, max: _max, ...rest } = last;
  return rest;
}

export function calcularImc(alturaTexto: string, pesoTexto: string): ImcResultado | null {
  const peso = parseNumeroBr(pesoTexto);
  const alturaRaw = parseNumeroBr(alturaTexto);
  if (peso == null || alturaRaw == null) return null;
  const alturaM = alturaParaMetros(alturaRaw);
  if (alturaM == null || alturaM <= 0) return null;
  const imc = peso / (alturaM * alturaM);
  if (!Number.isFinite(imc) || imc <= 0) return null;
  return {
    imc,
    imcFormatado: imc.toFixed(1).replace('.', ','),
    classificacao: classificarImc(imc),
  };
}

/** Permite apenas dígitos e um separador decimal (, ou .). */
export function formatDecimalInput(texto: string, maxLen = 6): string {
  const limpo = texto.replace(/[^\d.,]/g, '');
  const sep = limpo.includes(',') ? ',' : limpo.includes('.') ? '.' : '';
  if (!sep) return limpo.slice(0, maxLen);
  const [a, ...rest] = limpo.split(/[.,]/);
  const dec = rest.join('').replace(/[.,]/g, '');
  return `${a.slice(0, 3)}${sep}${dec.slice(0, 2)}`.slice(0, maxLen);
}
