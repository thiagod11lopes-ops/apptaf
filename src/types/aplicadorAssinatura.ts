export type AplicadorAssinaturaResumo = {
  aplicadorId: string;
  nome: string;
  nip: string;
  categoria: 'Oficiais' | 'Praças';
  postoGrad: string;
  /** Rúbrica desenhada pelo aplicador após confirmar a senha. */
  rubricaSvg?: string;
};

export function postoGradAplicador(item: {
  categoria: 'Oficiais' | 'Praças';
  oficial?: string;
  praca?: string;
}): string {
  if (item.categoria === 'Oficiais') return (item.oficial || '').trim() || '—';
  return (item.praca || '').trim() || '—';
}

/** Posto ou graduação exibido na linha de assinatura (não "Oficiais"/"Praças"). */
export function postoGradExibicaoAssinatura(assinatura: AplicadorAssinaturaResumo): string {
  const posto = assinatura.postoGrad?.trim();
  if (posto) return posto;
  return '—';
}
