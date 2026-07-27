import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { NormaTafVista } from './normaTafResultados';
import { filtrarSessoesPorNorma } from './normaTafResultados';
import { gerarDadosDemonstracaoTaf } from './gerarDadosDemonstracaoTaf';
import { isDemoSessaoId } from './gatherSystemBackupData';

/** Sessões fictícias só para cards do Histórico (nunca vão ao IndexedDB). */
export function gerarSessoesHistoricoModoTeste(norma: NormaTafVista): SessaoAplicacaoTaf[] {
  const { sessoes } = gerarDadosDemonstracaoTaf();
  return filtrarSessoesPorNorma(sessoes, norma).slice(0, 6);
}

export function isSessaoModoTeste(sessao: Pick<SessaoAplicacaoTaf, 'id'> | null | undefined): boolean {
  return isDemoSessaoId(sessao?.id);
}

/** Une sessões reais com cards de modo teste (sempre no final da lista). */
export function mesclarSessoesHistoricoComModoTeste(
  sessoesReais: SessaoAplicacaoTaf[],
  incluirModoTeste: boolean,
  norma: NormaTafVista | null,
): SessaoAplicacaoTaf[] {
  const reais = sessoesReais.filter((s) => !isSessaoModoTeste(s));
  if (!incluirModoTeste || !norma) return reais;
  return [...reais, ...gerarSessoesHistoricoModoTeste(norma)];
}
