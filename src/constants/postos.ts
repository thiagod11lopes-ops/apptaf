/** Opções do select de Posto (Oficial). Exibir com label em SVG onde necessário (2° Ten / 1° Ten). */
export const POSTOS = [
  'GM',
  '2°Ten',
  '1°Ten',
  'CT',
  'CC',
  'CF',
  'CMG',
  'C Alte',
  'V Alte',
  'Alte Esq',
] as const;

export type Posto = (typeof POSTOS)[number];
