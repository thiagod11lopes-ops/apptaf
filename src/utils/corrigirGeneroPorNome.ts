import {
  addCadastro,
  addCadastrosEmLote,
  getAllCadastros,
  type CadastroItemPersist,
} from '../services/cadastrosIndexedDb';
import {
  DICIONARIO_NOMES_GENERO,
  isNomeGeneroDuvidoso,
  MASCULINOS_TERMINADOS_EM_A,
  type GeneroNome,
} from '../data/dicionarioNomesGenero';
import { isDemoCadastroId } from './gatherSystemBackupData';
import {
  getGeneroManualCadastroIds,
  marcarGeneroManualCadastro,
} from './generoManualOverrides';

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

/**
 * Heurísticas por final do nome (dicionário tem prioridade):
 * - "-ção" (cao) → feminino
 * - termina em "o" → masculino
 * - termina em "a" → feminino (padrão BR), exceto masculinos conhecidos;
 *   nomes duvidosos/unissex ficam sem classificação (não identificados)
 */
function classificarPorSufixo(key: string): GeneroNome | null {
  if (key.length < 2) return null;
  if (isNomeGeneroDuvidoso(key)) return null;

  // Conceição, Consolação, Assunção, etc.
  if (key.endsWith('cao')) return 'F';
  if (key.endsWith('o')) return 'M';

  if (key.endsWith('a')) {
    if (MASCULINOS_TERMINADOS_EM_A.has(key)) return 'M';
    return 'F';
  }
  return null;
}

export function classificarGeneroPrimeiroNome(primeiroNome: string): GeneroNome | null {
  const key = normalizarNomeChave(primeiroNome);
  if (!key) return null;
  if (isNomeGeneroDuvidoso(key)) return null;
  return DICIONARIO_NOMES_GENERO[key] ?? classificarPorSufixo(key);
}

function sexoCadastro(c: CadastroItemPersist): 'M' | 'F' | undefined {
  return c.sexo === 'F' ? 'F' : c.sexo === 'M' ? 'M' : undefined;
}

function contarSexo(
  sexo: 'M' | 'F',
  acc: { homens: number; mulheres: number },
): void {
  if (sexo === 'M') acc.homens += 1;
  else acc.mulheres += 1;
}

type LinhaGenero = {
  c: CadastroItemPersist;
  primeiroNome: string;
  sugerido: GeneroNome | null;
  atual: 'M' | 'F' | undefined;
  manual: boolean;
};

async function carregarLinhasGenero(): Promise<{
  lista: CadastroItemPersist[];
  linhas: LinhaGenero[];
}> {
  const lista = (await getAllCadastros({ includeDemo: false })).filter(
    (c) => c?.id && !isDemoCadastroId(c.id),
  );
  const manuais = await getGeneroManualCadastroIds();
  const linhas = lista.map((c) => {
    const primeiroNome = extrairPrimeiroNome(c.nome);
    return {
      c,
      primeiroNome,
      sugerido: classificarGeneroPrimeiroNome(primeiroNome),
      atual: sexoCadastro(c),
      manual: manuais.has(c.id),
    };
  });
  return { lista, linhas };
}

/**
 * Analisa a Planilha e, se `persistir`, aplica o gênero sugerido.
 * Correções manuais (marcadas) nunca são sobrescritas.
 * Sem sugestão e sem sexo → não identificados.
 */
export async function corrigirGeneroCadastrosPlanilha(
  opts?: { persistir?: boolean },
): Promise<ResultadoCorrecaoGenero> {
  const persistir = opts?.persistir !== false;
  const { lista, linhas } = await carregarLinhasGenero();

  const acc = { homens: 0, mulheres: 0 };
  let modificados = 0;
  let jaCorretos = 0;
  const naoIdentificados: CadastroNaoIdentificadoGenero[] = [];
  const paraSalvar: CadastroItemPersist[] = [];

  for (const row of linhas) {
    const { c, primeiroNome, sugerido, atual, manual } = row;

    // Manual: nunca sobrescrever; contar o que está gravado.
    if (manual && atual) {
      contarSexo(atual, acc);
      jaCorretos += 1;
      continue;
    }

    if (!sugerido) {
      if (atual) {
        contarSexo(atual, acc);
        jaCorretos += 1;
      } else {
        naoIdentificados.push({
          id: c.id,
          nome: (c.nome || '').trim() || '—',
          nip: (c.nip || '').trim(),
          primeiroNome: primeiroNome || '—',
          sexoAtual: undefined,
        });
      }
      continue;
    }

    if (atual === sugerido) {
      contarSexo(atual, acc);
      jaCorretos += 1;
      continue;
    }

    // Divergente ou sem sexo: na leitura mostra o gravado (se houver); ao persistir aplica sugestão.
    if (!persistir) {
      if (atual) {
        contarSexo(atual, acc);
        jaCorretos += 1;
      } else {
        // Ainda sem sexo — entrará nos contadores após clicar em corrigir.
        contarSexo(sugerido, acc);
      }
      continue;
    }

    contarSexo(sugerido, acc);
    modificados += 1;
    paraSalvar.push({ ...c, sexo: sugerido, updatedAt: Date.now() });
  }

  if (persistir && paraSalvar.length > 0) {
    await addCadastrosEmLote(paraSalvar);
  }

  naoIdentificados.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    total: lista.length,
    homens: acc.homens,
    mulheres: acc.mulheres,
    naoIdentificados,
    modificados: persistir ? modificados : 0,
    jaCorretos,
  };
}

/** Só lê a Planilha e monta contadores (não grava). */
export async function carregarResumoGeneroPlanilha(): Promise<ResultadoCorrecaoGenero> {
  return corrigirGeneroCadastrosPlanilha({ persistir: false });
}

/** Mesmo padrão do modal: Feminino só se já for F; caso contrário Masculino. */
export function generoMarcadoNoModal(sexoAtual?: 'M' | 'F'): 'M' | 'F' {
  return sexoAtual === 'F' ? 'F' : 'M';
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
  await marcarGeneroManualCadastro(id);
  // Confirma leitura após gravação (evita UI otimista sem persistência).
  const depois = (await getAllCadastros({ includeDemo: false })).find((c) => c.id === id);
  if (depois?.sexo !== sexo) {
    throw new Error('Não foi possível gravar o gênero na Planilha. Faça login e tente de novo.');
  }
  return { ...depois };
}

/** Grava em lote o gênero já marcado (igual ao modal) para os não identificados. */
export async function salvarGenerosMarcadosEmLote(
  itens: Array<{ id: string; sexo: 'M' | 'F' }>,
): Promise<number> {
  if (itens.length === 0) return 0;
  const lista = await getAllCadastros({ includeDemo: false });
  const byId = new Map(lista.map((c) => [c.id, c]));
  const paraSalvar: CadastroItemPersist[] = [];
  const agora = Date.now();

  for (const item of itens) {
    const found = byId.get(item.id);
    if (!found) continue;
    paraSalvar.push({ ...found, sexo: item.sexo, updatedAt: agora });
  }

  if (paraSalvar.length === 0) return 0;
  await addCadastrosEmLote(paraSalvar);
  await Promise.all(paraSalvar.map((c) => marcarGeneroManualCadastro(c.id)));
  return paraSalvar.length;
}
