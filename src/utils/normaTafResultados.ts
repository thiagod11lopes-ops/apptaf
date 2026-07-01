import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { NormaTafPreCadastro } from '../services/preCadastroTafStorage';
import { isProvaNavalExclusiva } from '../taf/tafProvaTypes';
import { unificarSessoesComCadastroRegistrador } from './sessoesUnificadasResultados';
import {
  temAvaliacaoCaminhada,
  temAvaliacaoCorrida,
  temAvaliacaoNatacao,
  temAvaliacaoPermanencia,
} from './resultadoTafCadastro';

export type NormaTafVista = NormaTafPreCadastro;

export function inferNormaSessao(sessao: SessaoAplicacaoTaf): NormaTafVista {
  if (sessao.normaTaf === 'cfn' || sessao.normaTaf === 'armada') return sessao.normaTaf;
  if (isProvaNavalExclusiva(sessao.tipoProva)) return 'cfn';
  if (sessao.tipoProva === 'caminhada') return 'armada';
  return 'armada';
}

export function filtrarSessoesPorNorma(
  sessoes: SessaoAplicacaoTaf[],
  norma: NormaTafVista,
): SessaoAplicacaoTaf[] {
  return sessoes.filter((s) => inferNormaSessao(s) === norma);
}

export function cadastroTemResultadoCfn(c: CadastroItemPersist): boolean {
  return !!(
    c.repsFlexaoBarra != null ||
    (c.notaFlexaoBarra ?? '').trim() ||
    c.repsFlexaoSolo != null ||
    (c.notaFlexaoSolo ?? '').trim() ||
    c.repsAbdominalRemador != null ||
    (c.notaAbdominalRemador ?? '').trim() ||
    (c.tempoAbdominalPrancha ?? '').trim() ||
    (c.notaAbdominalPrancha ?? '').trim()
  );
}

export function cadastroTemResultadoArmada(c: CadastroItemPersist): boolean {
  return (
    temAvaliacaoCorrida(c) ||
    temAvaliacaoCaminhada(c) ||
    temAvaliacaoNatacao(c) ||
    temAvaliacaoPermanencia(c)
  );
}

/** Mantém cadastros com resultado da norma; inclui quem só aparece no histórico filtrado. */
export function filtrarCadastrosPorNorma(
  cadastros: CadastroItemPersist[],
  norma: NormaTafVista,
  sessoesFiltradas: SessaoAplicacaoTaf[],
): CadastroItemPersist[] {
  const nipsSessao = new Set<string>();
  for (const s of sessoesFiltradas) {
    for (const r of s.resultados) {
      const nip = (r.nip ?? '').replace(/\D/g, '');
      if (nip.length >= 8) nipsSessao.add(nip);
    }
  }

  return cadastros.filter((c) => {
    const nip = (c.nip ?? '').replace(/\D/g, '');
    const noHistorico = nip.length >= 8 && nipsSessao.has(nip);
    if (norma === 'cfn') {
      return cadastroTemResultadoCfn(c) || noHistorico;
    }
    return cadastroTemResultadoArmada(c) || noHistorico;
  });
}

export const NORMA_TAF_LABEL: Record<NormaTafVista, string> = {
  armada: 'TAF Armada',
  cfn: 'TAF CFN',
};

export function cadastroComResultadoNorma(c: CadastroItemPersist, norma: NormaTafVista): boolean {
  return norma === 'cfn' ? cadastroTemResultadoCfn(c) : cadastroTemResultadoArmada(c);
}

/** Sessões e cadastros já unificados/filtrados para a norma escolhida. */
export function prepararDadosResultadosNorma(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  norma: NormaTafVista,
): { sessoesNorma: SessaoAplicacaoTaf[]; cadastrosNorma: CadastroItemPersist[] } {
  const unificadas = unificarSessoesComCadastroRegistrador(sessoes, cadastros);
  const sessoesNorma = filtrarSessoesPorNorma(unificadas, norma);
  const cadastrosNorma = filtrarCadastrosPorNorma(cadastros, norma, sessoesNorma);
  return { sessoesNorma, cadastrosNorma };
}
