import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { nipDigitos } from './nipFormat';
import { buscarCadastroPorNomeOuNip } from './buscarCadastroPorNomeOuNip';
import { compareByNomePtBr } from './compareNomePtBr';
import { mesclarRubricas, rubricasDoCadastro, type RubricasPorNip } from './rubricasDasSessoes';
import { temRegistroModalidade } from './tafRegistro';

export type ResultadoTafLinha = {
  id: string;
  postoGrad: string;
  nip: string;
  nome: string;
  notaCorrida: string;
  situacaoCorrida: string;
  notaCaminhada: string;
  situacaoCaminhada: string;
  notaNatacao: string;
  situacaoNatacao: string;
  permanenciaTempo: string;
  situacaoPermanencia: string;
  rubricaCorridaSvg?: string;
  rubricaCaminhadaSvg?: string;
  rubricaNatacaoSvg?: string;
  rubricaPermanenciaSvg?: string;
  /** Datas de aplicação (DD/MM/AAAA) para definir corrida × caminhada excludentes. */
  dataTafCorrida?: string;
  dataTafCaminhada?: string;
};

function tempos(c: CadastroItemPersist) {
  const x = c as CadastroItemPersist & { tempo?: string };
  return {
    corrida: (c.tempoCorrida ?? x.tempo ?? '').trim(),
    natacao: (c.tempoNatacao ?? '').trim(),
    caminhada: (c.tempoCaminhada ?? '').trim(),
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

function resultadoPermanenciaCadastro(c: CadastroItemPersist): 'aprovado' | 'reprovado' | undefined {
  return c.resultadoPermanencia ?? c.resultadoNatacao;
}

function situacaoPermanencia(c: CadastroItemPersist): string {
  const r = resultadoPermanenciaCadastro(c);
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
  return !!(resultadoPermanenciaCadastro(c) || t.permanencia);
}

export function temAvaliacaoCaminhada(c: CadastroItemPersist): boolean {
  const t = tempos(c);
  return !!(t.caminhada || (c.notaCaminhada || '').trim());
}

/** Corrida 2.400 m ou caminhada 4.800 m — uma substitui a outra no TAF. */
export function temAvaliacaoCorridaOuCaminhada(c: CadastroItemPersist): boolean {
  return temAvaliacaoCorrida(c) || temAvaliacaoCaminhada(c);
}

/** Militar com avaliação nas três modalidades (corrida ou caminhada, natação e permanência). */
export function cadastroComTafCompleto(c: CadastroItemPersist): boolean {
  return (
    temAvaliacaoCorridaOuCaminhada(c) &&
    temAvaliacaoNatacao(c) &&
    temAvaliacaoPermanencia(c)
  );
}

export type ResumoInicioTaf = {
  totalCadastrados: number;
  realizaramTaf: number;
};

/** Resumo legado com base no cadastro. A aba Iniciar usa {@link calcularResumoInicioTafFromHistorico}. */
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
  const temCorrida = temAvaliacaoCorridaOuCaminhada(c);
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

/**
 * Pendências com base no cadastro.
 * A aba Pendência Parcial usa {@link listarPendenciasParciaisFromHistorico} (somente Histórico).
 */
export function listarPendenciasParciais(cadastros: CadastroItemPersist[]): PendenciaParcialItem[] {
  return cadastros
    .filter(cadastroComPendenciaParcialTaf)
    .map(pendenciaParcialFromCadastro)
    .sort(compareByNomePtBr);
}

export type ResultadoGeralItem = ResultadoTafLinha & {
  statusTaf: 'Completo' | 'Parcial';
};

/**
 * Militares com TAF no cadastro (ao menos uma modalidade).
 * A aba Resultado Geral usa {@link listarResultadosGeralFromHistorico} (somente sessões do Histórico).
 */
export function listarResultadosGeral(cadastros: CadastroItemPersist[]): ResultadoGeralItem[] {
  return cadastros
    .filter(cadastroComAlgumResultadoTaf)
    .map((c) => ({
      ...cadastroParaLinhaResultado(c),
      statusTaf: cadastroComTafCompleto(c) ? ('Completo' as const) : ('Parcial' as const),
    }))
    .sort(compareByNomePtBr);
}

export function postoGradFromCadastro(
  c: Pick<CadastroItemPersist, 'categoria' | 'oficial' | 'praca'>,
): string {
  if (c.categoria === 'Oficiais') return (c.oficial || '').trim() || '—';
  return (c.praca || '').trim() || '—';
}

export function postoGradFromLinhaId(
  linhaId: string,
  nip: string,
  cadastros: CadastroItemPersist[],
): string {
  const porId = cadastros.find((c) => c.id === linhaId);
  if (porId) return postoGradFromCadastro(porId);
  const chave = nip !== '—' ? nip : '';
  if (!chave) return '—';
  const busca = buscarCadastroPorNomeOuNip(cadastros, chave);
  return busca.kind === 'found' ? postoGradFromCadastro(busca.cadastro) : '—';
}

export function cadastroParaLinhaResultado(c: CadastroItemPersist): ResultadoTafLinha {
  const t = tempos(c);
  const temCorrida = !!(t.corrida || (c.notaCorrida || '').trim());
  const temCaminhada = !!(t.caminhada || (c.notaCaminhada || '').trim());
  const temNatacao = !!(t.natacao || (c.notaNatacao || '').trim());
  const temPerm = !!(resultadoPermanenciaCadastro(c) || t.permanencia);

  return {
    id: c.id,
    postoGrad: postoGradFromCadastro(c),
    nip: c.nip || '—',
    nome: c.nome || '—',
    notaCorrida: temCorrida ? (c.notaCorrida || '—').trim() || '—' : '—',
    situacaoCorrida: situacaoDeNota(c.notaCorrida, temCorrida),
    notaCaminhada: temCaminhada ? (c.notaCaminhada || '—').trim() || '—' : '—',
    situacaoCaminhada: situacaoDeNota(c.notaCaminhada, temCaminhada),
    notaNatacao: temNatacao ? (c.notaNatacao || '—').trim() || '—' : '—',
    situacaoNatacao: situacaoDeNota(c.notaNatacao, temNatacao),
    permanenciaTempo: temPerm ? t.permanencia || '—' : '—',
    situacaoPermanencia: temPerm ? situacaoPermanencia(c) : '—',
    rubricaCorridaSvg: temCorrida ? c.rubricaCorridaSvg : undefined,
    rubricaCaminhadaSvg: temCaminhada ? c.rubricaCaminhadaSvg : undefined,
    rubricaNatacaoSvg: temNatacao ? c.rubricaNatacaoSvg : undefined,
    rubricaPermanenciaSvg: temPerm ? c.rubricaPermanenciaSvg : undefined,
    dataTafCorrida: temCorrida ? (c.dataTafCorrida || '').trim() || undefined : undefined,
    dataTafCaminhada: temCaminhada ? (c.dataTafCaminhada || '').trim() || undefined : undefined,
  };
}

export function mesclarRubricasNaLinha(
  linha: ResultadoTafLinha,
  rubricas: {
    corrida?: string;
    caminhada?: string;
    natacao?: string;
    permanencia?: string;
  },
): ResultadoTafLinha {
  return {
    ...linha,
    rubricaCorridaSvg: linha.rubricaCorridaSvg ?? rubricas.corrida,
    rubricaCaminhadaSvg: linha.rubricaCaminhadaSvg ?? rubricas.caminhada,
    rubricaNatacaoSvg: linha.rubricaNatacaoSvg ?? rubricas.natacao,
    rubricaPermanenciaSvg: linha.rubricaPermanenciaSvg ?? rubricas.permanencia,
  };
}

function cadastroPorLinha(
  linha: ResultadoTafLinha,
  cadastros: CadastroItemPersist[],
): CadastroItemPersist | undefined {
  const porId = cadastros.find((c) => c.id === linha.id);
  if (porId) return porId;
  const chave = linha.nip !== '—' ? linha.nip : linha.nome;
  const busca = buscarCadastroPorNomeOuNip(cadastros, chave);
  return busca.kind === 'found' ? busca.cadastro : undefined;
}

/** Preenche rúbricas ausentes na linha a partir do cadastro local e do mapa por NIP (sessões). */
export function enriquecerLinhasComRubricas(
  linhas: ResultadoTafLinha[],
  cadastros: CadastroItemPersist[],
  rubricasSessoes?: Map<string, RubricasPorNip>,
): ResultadoTafLinha[] {
  return linhas.map((linha) => {
    const c = cadastroPorLinha(linha, cadastros);
    const rubCadastro = c ? rubricasDoCadastro(c) : {};
    const key = nipDigitos(linha.nip);
    const rubSessao = key && rubricasSessoes ? rubricasSessoes.get(key) : undefined;
    return mesclarRubricasNaLinha(linha, mesclarRubricas(rubCadastro, rubSessao));
  });
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

  return lista.sort(compareByNomePtBr);
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
