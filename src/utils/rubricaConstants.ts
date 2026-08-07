/** Dimensões nativas do canvas de captura da rúbrica (Aplicar TAF). */
export const RUBRICA_NATIVA_LARGURA = 420;
export const RUBRICA_NATIVA_ALTURA = 180;

/** Resolução persistida (WebP/PNG) — menor que a captura, suficiente para PDF. */
export const RUBRICA_RASTER_LARGURA = 280;
export const RUBRICA_RASTER_ALTURA = 120;
export const RUBRICA_WEBP_QUALITY = 0.72;

/**
 * No lote SVG→WebP, cede a UI a cada N rúbricas rasterizadas.
 * 1 = máxima fluidez (chefe assina enquanto o lote corre).
 */
export const RUBRICA_LOTE_YIELD_A_CADA = 1;

/** Exibição no PDF — compacta (≈21% da captura nativa; metade do tamanho anterior). */
export const RUBRICA_PDF_LARGURA = 90;
export const RUBRICA_PDF_ALTURA = 39;
