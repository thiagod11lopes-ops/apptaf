import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { isDemoSessaoId } from './gatherSystemBackupData';

/** Sessão gravada no Modo Teste (id demo-sess-*) — tarja no Histórico. */
export function isSessaoModoTeste(sessao: Pick<SessaoAplicacaoTaf, 'id'> | null | undefined): boolean {
  return isDemoSessaoId(sessao?.id);
}
