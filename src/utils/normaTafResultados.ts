import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { NormaTafPreCadastro } from '../services/preCadastroTafStorage';
import { isProvaNavalExclusiva } from '../taf/tafProvaTypes';
import { unificarSessoesComCadastroRegistrador } from './sessoesUnificadasResultados';
import { agruparSessoesHistoricoPorTeste } from './agruparSessoesHistoricoPorTeste';
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

/**
 * Mantém cadastros com resultado da norma; inclui quem só aparece no histórico filtrado.
 *
 * Regra de norma (definitiva):
 *  - CFN: somente cadastros com `normaTaf === 'cfn'` explícito.
 *  - ARMADA: cadastros com `normaTaf === 'armada'` ou sem normaTaf (legados).
 *  Os campos de resultado aceitos para CFN incluem tanto os exclusivos de CFN
 *  (flexão/abdominal) quanto os comuns (corrida/natação/permanência), pois
 *  militares CFN também realizam essas provas.
 */
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
    // CFN: exige registro explícito como CFN.
    if (norma === 'cfn' && c.normaTaf !== 'cfn') return false;
    // ARMADA: exclui quem foi explicitamente registrado como CFN.
    if (norma === 'armada' && c.normaTaf === 'cfn') return false;

    const nip = (c.nip ?? '').replace(/\D/g, '');
    const noHistorico = nip.length >= 8 && nipsSessao.has(nip);

    if (norma === 'cfn') {
      // Aceita qualquer resultado: CFN exclusivo ou provas comuns (corrida/natação/permanência).
      return cadastroTemResultadoCfn(c) || cadastroTemResultadoArmada(c) || noHistorico;
    }
    return cadastroTemResultadoArmada(c) || noHistorico;
  });
}

export const NORMA_TAF_LABEL: Record<NormaTafVista, string> = {
  armada: 'TAF Armada',
  cfn: 'TAF CFN',
};

export function cadastroComResultadoNorma(c: CadastroItemPersist, norma: NormaTafVista): boolean {
  if (norma === 'cfn') {
    // CFN: somente cadastros explicitamente registrados como CFN.
    if (c.normaTaf !== 'cfn') return false;
    return cadastroTemResultadoCfn(c) || cadastroTemResultadoArmada(c);
  }
  // ARMADA: exclui CFN-registrados; aceita legados (sem normaTaf) e Armada explícitos.
  if (c.normaTaf === 'cfn') return false;
  return cadastroTemResultadoArmada(c);
}

/** Sessões e cadastros já unificados/filtrados para a norma escolhida. */
export function prepararDadosResultadosNorma(
  sessoes: SessaoAplicacaoTaf[],
  cadastros: CadastroItemPersist[],
  norma: NormaTafVista,
  opts?: { jaUnificadas?: boolean },
): { sessoesNorma: SessaoAplicacaoTaf[]; cadastrosNorma: CadastroItemPersist[] } {
  const sessoesSemDemo = sessoes.filter((s) => !s.id.startsWith('demo-sess-'));
  const cadastrosSemDemo = cadastros.filter((c) => !c.id.startsWith('demo-cad-'));
  const unificadas = opts?.jaUnificadas
    ? sessoesSemDemo
    : unificarSessoesComCadastroRegistrador(sessoesSemDemo, cadastrosSemDemo);
  const sessoesNorma = agruparSessoesHistoricoPorTeste(
    filtrarSessoesPorNorma(unificadas, norma),
  );
  const cadastrosNorma = filtrarCadastrosPorNorma(cadastrosSemDemo, norma, sessoesNorma);
  return { sessoesNorma, cadastrosNorma };
}
