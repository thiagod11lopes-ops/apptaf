import { describe, expect, it } from 'vitest';

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
});
