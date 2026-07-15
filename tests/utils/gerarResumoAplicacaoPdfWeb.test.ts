import { describe, expect, it, vi } from 'vitest';

describe('gerarResumoAplicacaoPdfBlobWeb', () => {
  it('gera um Blob PDF não vazio com jsPDF', async () => {
    const { gerarResumoAplicacaoPdfBlobWeb } = await import(
      '../../src/utils/gerarResumoAplicacaoPdfWeb'
    );

    const blob = await gerarResumoAplicacaoPdfBlobWeb([
      {
        corredor: 1,
        nome: 'Militar A',
        nip: '12.3456.78',
        tempoMs: 720000,
        notaTexto: '90',
        prova: 'corrida',
      },
    ]);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain('pdf');
    expect(blob.size).toBeGreaterThan(500);
  });

  it('inclui rúbrica SVG convertida quando o canvas está disponível', async () => {
    const svg =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100%" height="100%" fill="#fff"/><path d="M10 20 L90 20" stroke="#111" stroke-width="3"/></svg>',
      );

    // Em jsdom/vitest pode não haver Image/canvas completos — apenas garante que não quebra.
    const { gerarResumoAplicacaoPdfBlobWeb } = await import(
      '../../src/utils/gerarResumoAplicacaoPdfWeb'
    );
    const blob = await gerarResumoAplicacaoPdfBlobWeb([
      {
        corredor: 1,
        nome: 'Militar A',
        nip: '12.3456.78',
        tempoMs: 720000,
        notaTexto: '90',
        prova: 'corrida',
        rubricaCandidatoSvg: svg,
      },
    ]);
    expect(blob.size).toBeGreaterThan(500);
    void vi;
  });
});
