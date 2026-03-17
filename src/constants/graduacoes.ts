/** Opções do select de Graduação (Praça). Exibir "SO" com label em SVG se necessário. */
export const GRADUACOES = ['MN', 'CB', '3°SG', '2°SG', '1°SG', 'SO'] as const;

export type Graduacao = (typeof GRADUACOES)[number];
