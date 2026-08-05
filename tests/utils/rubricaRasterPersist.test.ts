import { describe, expect, it } from 'vitest';
import {
  isRubricaRasterDataUrl,
  isRubricaSvgDataUrl,
  precisaRasterizarRubrica,
  rubricaDataUrlPdfFormat,
  rubricaParaPersistencia,
  rasterizarRubricasNaSessao,
} from '../../src/utils/rubricaRasterPersist';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

describe('rubricaRasterPersist', () => {
  it('detecta SVG e raster', () => {
    expect(isRubricaSvgDataUrl('data:image/svg+xml;utf8,%3Csvg')).toBe(true);
    expect(isRubricaRasterDataUrl('data:image/webp;base64,AAA')).toBe(true);
    expect(isRubricaRasterDataUrl('data:image/png;base64,AAA')).toBe(true);
    expect(precisaRasterizarRubrica('data:image/svg+xml;utf8,%3Csvg')).toBe(true);
    expect(precisaRasterizarRubrica('data:image/webp;base64,AAA')).toBe(false);
  });

  it('identifica formato para jsPDF', () => {
    expect(rubricaDataUrlPdfFormat('data:image/png;base64,x')).toBe('PNG');
    expect(rubricaDataUrlPdfFormat('data:image/webp;base64,x')).toBe('WEBP');
    expect(rubricaDataUrlPdfFormat('data:image/jpeg;base64,x')).toBe('JPEG');
    expect(rubricaDataUrlPdfFormat('data:image/svg+xml;utf8,x')).toBeNull();
  });

  it('mantém raster e passa SVG intacto sem canvas (node)', () => {
    const webp = 'data:image/webp;base64,AAAA';
    expect(rubricaParaPersistencia(webp)).toBe(webp);
    const svg = 'data:image/svg+xml;utf8,%3Csvg%3E';
    // Sem document/canvas no vitest — preserva SVG.
    expect(rubricaParaPersistencia(svg)).toBe(svg);
  });

  it('rasterizarRubricasNaSessao não altera quando já é raster', () => {
    const sessao = {
      id: 's1',
      criadoEm: '',
      dataAplicacao: '',
      tipoProva: 'corrida',
      resultados: [
        {
          corredor: 1,
          nome: 'A',
          nip: '11.1111.11',
          tempoMs: 0,
          rubricaCandidatoSvg: 'data:image/png;base64,AAA',
        },
      ],
    } as SessaoAplicacaoTaf;
    const { mudou, sessao: next } = rasterizarRubricasNaSessao(sessao);
    expect(mudou).toBe(false);
    expect(next).toBe(sessao);
  });
});
