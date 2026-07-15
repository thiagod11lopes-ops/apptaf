import { describe, expect, it } from 'vitest';
import { nomeArquivoPdfResumo } from '../../src/utils/exportResumoAplicacaoPdf';

describe('nomeArquivoPdfResumo', () => {
  it('usa NomeDoTeste_DataDoTeste_HoraDoSalvamento', () => {
    const when = new Date('2026-07-14T21:05:32-03:00');
    const name = nomeArquivoPdfResumo(
      [
        {
          corredor: 1,
          nome: 'Militar A',
          nip: '12.3456.78',
          tempoMs: 720000,
          notaTexto: '90',
          prova: 'corrida',
        },
      ],
      when,
    );
    expect(name).toMatch(/^Corrida_14-07-2026_\d{2}h\d{2}m\d{2}\.pdf$/);
  });
});
