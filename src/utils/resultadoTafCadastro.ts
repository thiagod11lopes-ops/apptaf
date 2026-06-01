import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { nipDigitos } from './nipFormat';
import { temRegistroModalidade } from './tafRegistro';

export type ResultadoTafLinha = {
  id: string;
  nip: string;
  nome: string;
  notaCorrida: string;
  situacaoCorrida: string;
  notaNatacao: string;
  situacaoNatacao: string;
  permanenciaTempo: string;
  situacaoPermanencia: string;
  rubricaCorridaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
};

function tempos(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: (c.tempoCorrida ?? x.tempo ?? '').trim(),
    natacao: (c.tempoNatacao ?? '').trim(),
    permanencia: (c.tempoPermanencia ?? '').trim(),
  };
}

function situacaoDeNota(nota: string | undefined, temRegistro: boolean): string {
  if (!temRegistro) return '—';
  const n = (nota || '').trim();
  if (!n) return '—';
  if (n.toUpperCase() === 'REPROVADO') return 'Reprovado';
  return 'Aprovado';
}

function situacaoPermanencia(c: CadastroItemPersist): string {
  const r = c.resultadoPermanencia;
  if (r === 'aprovado') return 'Aprovado';
  if (r === 'reprovado') return 'Reprovado';
  const t = tempos(c).permanencia;
  if (t) return '—';
  return '—';
}

export function cadastroComAlgumResultadoTaf(c: CadastroItemPersist): boolean {
  return temRegistroModalidade(c, 'Todos');
}

export function temAvaliacaoCorrida(c: CadastroItemPersist): boolean {
  const t = tempos(c);
  return !!(t.corrida || (c.notaCorrida || '').trim());
}

export function temAvaliacaoNatacao(c: CadastroItemPersist): boolean {
  const t = tempos(c);
  return !!(t.natacao || (c.notaNatacao || '').trim());
}

export function temAvaliacaoPermanencia(c: CadastroItemPersist): boolean {
  const t = tempos(c);
  return !!(c.resultadoPermanencia || t.permanencia);
}

/** Militar com avaliação nas três modalidades (corrida, natação e permanência). */
export function cadastroComTafCompleto(c: CadastroItemPersist): boolean {
  return temAvaliacaoCorrida(c) && temAvaliacaoNatacao(c) && temAvaliacaoPermanencia(c);
}

export type ResumoInicioTaf = {
  totalCadastrados: number;
  realizaramTaf: number;
};

export function calcularResumoInicioTaf(cadastros: CadastroItemPersist[]): ResumoInicioTaf {
  return {
    totalCadastrados: cadastros.length,
    realizaramTaf: cadastros.filter(cadastroComTafCompleto).length,
  };
}

/** Possui ao menos uma avaliação, mas não as três modalidades. */
export function cadastroComPendenciaParcialTaf(c: CadastroItemPersist): boolean {
  return cadastroComAlgumResultadoTaf(c) && !cadastroComTafCompleto(c);
}

export type PendenciaParcialItem = {
  id: string;
  nip: string;
  nome: string;
  temCorrida: boolean;
  temNatacao: boolean;
  temPermanencia: boolean;
  faltam: string[];
};

export function pendenciaParcialFromCadastro(c: CadastroItemPersist): PendenciaParcialItem {
  const temCorrida = temAvaliacaoCorrida(c);
  const temNatacao = temAvaliacaoNatacao(c);
  const temPermanencia = temAvaliacaoPermanencia(c);
  const faltam: string[] = [];
  if (!temCorrida) faltam.push('Corrida');
  if (!temNatacao) faltam.push('Natação');
  if (!temPermanencia) faltam.push('Permanência');

  return {
    id: c.id,
    nip: c.nip || '—',
    nome: c.nome || '—',
    temCorrida,
    temNatacao,
    temPermanencia,
    faltam,
  };
}

export function listarPendenciasParciais(cadastros: CadastroItemPersist[]): PendenciaParcialItem[] {
  return cadastros
    .filter(cadastroComPendenciaParcialTaf)
    .map(pendenciaParcialFromCadastro)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function cadastroParaLinhaResultado(c: CadastroItemPersist): ResultadoTafLinha {
  const t = tempos(c);
  const temCorrida = !!(t.corrida || (c.notaCorrida || '').trim());
  const temNatacao = !!(t.natacao || (c.notaNatacao || '').trim());
  const temPerm = !!(c.resultadoPermanencia || t.permanencia);

  return {
    id: c.id,
    nip: c.nip || '—',
    nome: c.nome || '—',
    notaCorrida: temCorrida ? (c.notaCorrida || '—').trim() || '—' : '—',
    situacaoCorrida: situacaoDeNota(c.notaCorrida, temCorrida),
    notaNatacao: temNatacao ? (c.notaNatacao || '—').trim() || '—' : '—',
    situacaoNatacao: situacaoDeNota(c.notaNatacao, temNatacao),
    permanenciaTempo: temPerm ? t.permanencia || '—' : '—',
    situacaoPermanencia: temPerm ? situacaoPermanencia(c) : '—',
    rubricaCorridaSvg: temCorrida ? c.rubricaCorridaSvg : undefined,
    rubricaNatacaoSvg: temNatacao ? c.rubricaNatacaoSvg : undefined,
    rubricaPermanenciaSvg: temPerm ? c.rubricaPermanenciaSvg : undefined,
  };
}

export function mesclarRubricasNaLinha(
  linha: ResultadoTafLinha,
  rubricas: {
    corrida?: string;
    natacao?: string;
    permanencia?: string;
  },
): ResultadoTafLinha {
  return {
    ...linha,
    rubricaCorridaSvg: linha.rubricaCorridaSvg ?? rubricas.corrida,
    rubricaNatacaoSvg: linha.rubricaNatacaoSvg ?? rubricas.natacao,
    rubricaPermanenciaSvg: linha.rubricaPermanenciaSvg ?? rubricas.permanencia,
  };
}

function stripDiacritics(s: string): string {
  try {
    return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  } catch {
    return s;
  }
}

type FiltroNipNomeOptions = {
  /** Se true (padrão), retorna apenas cadastros com ao menos um resultado TAF. */
  somenteComResultadoTaf?: boolean;
};

function filtrarCadastrosPorNipNomeBase(
  cadastros: CadastroItemPersist[],
  nipRaw: string,
  nomeRaw: string,
  options?: FiltroNipNomeOptions,
): CadastroItemPersist[] {
  const nipQ = nipDigitos(nipRaw);
  const nomeQ = stripDiacritics(nomeRaw.trim()).toLowerCase();
  if (!nipQ && !nomeQ) return [];

  let lista =
    options?.somenteComResultadoTaf === false
      ? [...cadastros]
      : cadastros.filter(cadastroComAlgumResultadoTaf);

  if (nipQ) {
    lista = lista.filter((c) => {
      const d = nipDigitos(c.nip);
      if (nipQ.length >= 8) return d === nipQ;
      return d.startsWith(nipQ);
    });
  }

  if (nomeQ) {
    lista = lista.filter((c) => {
      const n = stripDiacritics((c.nome || '').toLowerCase());
      if (nomeQ.length >= 3) return n.includes(nomeQ);
      return n === nomeQ || n.startsWith(nomeQ);
    });
  }

  return lista.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}

/** Busca por NIP e/ou nome; retorna vazio se ambos estiverem em branco. */
export function filtrarCadastrosPorNipNome(
  cadastros: CadastroItemPersist[],
  nipRaw: string,
  nomeRaw: string,
  options?: FiltroNipNomeOptions,
): CadastroItemPersist[] {
  return filtrarCadastrosPorNipNomeBase(cadastros, nipRaw, nomeRaw, {
    somenteComResultadoTaf: options?.somenteComResultadoTaf ?? true,
  });
}

export function linhasResultadoFromCadastros(cadastros: CadastroItemPersist[]): ResultadoTafLinha[] {
  return cadastros
    .filter(cadastroComAlgumResultadoTaf)
    .map(cadastroParaLinhaResultado);
}
