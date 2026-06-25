export type AplicadorAssinaturaResumo = {
  aplicadorId: string;
  nome: string;
  nip: string;
  categoria: 'Oficiais' | 'Praças';
  postoGrad: string;
  rubricaSvg: string;
};

export function postoGradAplicador(item: {
  categoria: 'Oficiais' | 'Praças';
  oficial?: string;
  praca?: string;
}): string {
  if (item.categoria === 'Oficiais') return (item.oficial || '').trim() || '—';
  return (item.praca || '').trim() || '—';
}
