import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import { getAllSessoesAplicacao } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';

function chaveAssinatura(assinatura: AplicadorAssinaturaResumo): string {
  return (
    assinatura.aplicadorId?.trim() ||
    `${(assinatura.nip ?? '').trim()}:${assinatura.nome.trim().toLowerCase()}`
  );
}

/**
 * Assinaturas distintas de aplicador nas sessões.
 * Quando o mesmo aplicador aparece mais de uma vez, prioriza a que tem rúbrica SVG.
 */
export function assinaturasUnicasDasSessoes(
  sessoes: SessaoAplicacaoTaf[],
): AplicadorAssinaturaResumo[] {
  const byKey = new Map<string, AplicadorAssinaturaResumo>();

  for (const sessao of sessoes) {
    const assinatura = sessao.aplicadorAssinatura;
    if (!assinatura?.nome?.trim()) continue;
    const key = chaveAssinatura(assinatura);
    const atual = byKey.get(key);
    if (!atual) {
      byKey.set(key, assinatura);
      continue;
    }
    const atualTemRubrica = Boolean(atual.rubricaSvg?.trim());
    const novaTemRubrica = Boolean(assinatura.rubricaSvg?.trim());
    if (!atualTemRubrica && novaTemRubrica) {
      byKey.set(key, assinatura);
    }
  }

  return Array.from(byKey.values());
}

/** Coleta assinaturas para o rodapé dos PDFs (sessões informadas ou todo o histórico). */
export async function coletarAssinaturasAplicadorParaPdf(
  sessoes?: SessaoAplicacaoTaf[],
): Promise<AplicadorAssinaturaResumo[]> {
  const lista = sessoes ?? (await getAllSessoesAplicacao());
  return assinaturasUnicasDasSessoes(lista);
}
