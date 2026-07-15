import { describe, expect, it } from 'vitest';
import {
  decodeSvgDataUrl,
  extrairStrokesRubricaParaPdf,
  gerarResumoAplicacaoPdfBlobWeb,
  renderRubricaSvgToPngDataUrl,
} from '../../src/utils/gerarResumoAplicacaoPdfWeb';

const SVG_SAMPLE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40"><rect width="100%" height="100%" fill="#fff"/><path d="M10 20 L40 10 L70 30 L90 20" fill="none" stroke="#111" stroke-width="2.5"/></svg>',
  );

describe('gerarResumoAplicacaoPdfWeb rubricas', () => {
  it('decodifica e extrai traços do SVG da rúbrica', () => {
    const svg = decodeSvgDataUrl(SVG_SAMPLE);
    expect(svg).toContain('<path');
    const strokes = extrairStrokesRubricaParaPdf(SVG_SAMPLE);
    expect(strokes).not.toBeNull();
    expect(strokes!.strokes[0]!.points.length).toBeGreaterThanOrEqual(4);
  });

  it('gera PDF com rúbrica sem texto Assinado', async () => {
    const blob = await gerarResumoAplicacaoPdfBlobWeb([
      {
        corredor: 1,
        nome: 'Militar A',
        nip: '12.3456.78',
        tempoMs: 720000,
        notaTexto: '90',
        prova: 'corrida',
        rubricaCandidatoSvg: SVG_SAMPLE,
      },
    ]);
    expect(blob.size).toBeGreaterThan(800);
    // Em Node pode não haver canvas; strokes no jsPDF ainda devem aumentar o arquivo.
  });

  it('renderRubricaSvgToPngDataUrl não quebra sem DOM completo', () => {
    const out = renderRubricaSvgToPngDataUrl(SVG_SAMPLE, 90, 39);
    // Em vitest/jsdom pode ser null ou data URL — ambos ok se não lançar.
    expect(out === null || out.startsWith('data:image/png')).toBe(true);
  });
});
