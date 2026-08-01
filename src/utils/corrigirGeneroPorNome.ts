import {
  addCadastro,
  addCadastrosEmLote,
  getAllCadastros,
  type CadastroItemPersist,
} from '../services/cadastrosIndexedDb';
import { DICIONARIO_NOMES_GENERO, type GeneroNome } from '../data/dicionarioNomesGenero';
import { isDemoCadastroId } from './gatherSystemBackupData';

export type CadastroNaoIdentificadoGenero = {
  id: string;
  nome: string;
  nip: string;
  primeiroNome: string;
  sexoAtual?: 'M' | 'F';
};

export type ResultadoCorrecaoGenero = {
  total: number;
  homens: number;
  mulheres: number;
  naoIdentificados: CadastroNaoIdentificadoGenero[];
  modificados: number;
  jaCorretos: number;
};

function normalizarNomeChave(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Postos/graduações conhecidos — não confundir com nomes curtos em maiúsculas (ex.: ABILIO). */
const POSTOS_GRAD_CONHECIDOS = new Set(
  [
    'GM',
    '2TEN',
    '2°TEN',
    '2ºTEN',
    '1TEN',
    '1°TEN',
    '1ºTEN',
    'CT',
    'CC',
    'CF',
    'CMG',
    'CALTE',
    'MN',
    'CB',
    '3SG',
    '3°SG',
    '3ºSG',
    '2SG',
    '2°SG',
    '2ºSG',
    '1SG',
    '1°SG',
    '1ºSG',
    'SO',
  ].map((p) => normalizarNomeChave(p)),
);

function parecePostoOuGrad(token: string): boolean {
  const key = normalizarNomeChave(token);
  if (!key) return false;
  if (POSTOS_GRAD_CONHECIDOS.has(key)) return true;
  // Formas com número + TEN/SG (ex.: 2TEN, 1SG) sem o símbolo °.
  return /^[123](ten|sg)$/.test(key);
}

/**
 * Extrai o primeiro nome próprio do cadastro (ignora posto/grad no início do texto).
 */
export function extrairPrimeiroNome(nomeCompleto: string): string {
  const parts = (nomeCompleto || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  let i = 0;
  if (parecePostoOuGrad(parts[0]!)) i = 1;
  while (i < parts.length) {
    const p = parts[i]!;
    // Partículas não são primeiro nome.
    const key = normalizarNomeChave(p);
    if (key === 'de' || key === 'da' || key === 'do' || key === 'dos' || key === 'das' || key === 'e') {
      i += 1;
      continue;
    }
    return p;
  }
  return parts[parecePostoOuGrad(parts[0]!) ? 1 : 0] ?? '';
}

export function classificarGeneroPrimeiroNome(primeiroNome: string): GeneroNome | null {
  const key = normalizarNomeChave(primeiroNome);
  if (!key) return null;
  return DICIONARIO_NOMES_GENERO[key] ?? null;
}

export async function corrigirGeneroCadastrosPlanilha(): Promise<ResultadoCorrecaoGenero> {
  const lista = (await getAllCadastros({ includeDemo: false })).filter(
    (c) => c?.id && !isDemoCadastroId(c.id),
  );

  let homens = 0;
  let mulheres = 0;
  let modificados = 0;
  let jaCorretos = 0;
  const naoIdentificados: CadastroNaoIdentificadoGenero[] = [];
  const paraSalvar: CadastroItemPersist[] = [];

  for (const c of lista) {
    const primeiroNome = extrairPrimeiroNome(c.nome);
    const genero = classificarGeneroPrimeiroNome(primeiroNome);

    if (!genero) {
      naoIdentificados.push({
        id: c.id,
        nome: (c.nome || '').trim() || '—',
        nip: (c.nip || '').trim(),
        primeiroNome: primeiroNome || '—',
        sexoAtual: c.sexo === 'F' ? 'F' : c.sexo === 'M' ? 'M' : undefined,
      });
      continue;
    }

    if (genero === 'M') homens += 1;
    else mulheres += 1;

    const atual = c.sexo === 'F' ? 'F' : c.sexo === 'M' ? 'M' : undefined;
    if (atual === genero) {
      jaCorretos += 1;
      continue;
    }

    modificados += 1;
    paraSalvar.push({ ...c, sexo: genero, updatedAt: Date.now() });
  }

  if (paraSalvar.length > 0) {
    await addCadastrosEmLote(paraSalvar);
  }

  naoIdentificados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    total: lista.length,
    homens,
    mulheres,
    naoIdentificados,
    modificados,
    jaCorretos,
  };
}

export async function salvarGeneroManualCadastro(
  id: string,
  sexo: 'M' | 'F',
): Promise<CadastroItemPersist | null> {
  const lista = await getAllCadastros({ includeDemo: false });
  const found = lista.find((c) => c.id === id);
  if (!found) return null;
  const atualizado: CadastroItemPersist = { ...found, sexo, updatedAt: Date.now() };
  await addCadastro(atualizado);
  return atualizado;
}
