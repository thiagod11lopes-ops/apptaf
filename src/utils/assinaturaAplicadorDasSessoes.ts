import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';
import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';

/** Assinaturas distintas de aplicador presentes nas sessões (ex.: PDF do histórico por dia). */
export function assinaturasUnicasDasSessoes(
  sessoes: SessaoAplicacaoTaf[],
): AplicadorAssinaturaResumo[] {
  const seen = new Set<string>();
  const out: AplicadorAssinaturaResumo[] = [];

  for (const sessao of sessoes) {
    const assinatura = sessao.aplicadorAssinatura;
    if (!assinatura?.nome?.trim()) continue;
    const key =
      assinatura.aplicadorId?.trim() ||
      `${(assinatura.nip ?? '').trim()}:${assinatura.nome.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(assinatura);
  }

  return out;
}
