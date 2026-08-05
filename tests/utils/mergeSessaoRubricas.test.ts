import { describe, expect, it } from 'vitest';
import {
  mergeSessaoResultadoRubricas,
  pickAplicadorRubricaSvg,
} from '../../src/utils/mergeSessaoRubricas';

const png = 'data:image/png;base64,AAA';
const webp = 'data:image/webp;base64,BBB';

describe('mergeSessaoRubricas', () => {
  it('une por NIP normalizado + prova e primary vence', () => {
    const out = mergeSessaoResultadoRubricas(
      [
        { nip: '11.1111.11', prova: 'corrida', rubricaCandidatoSvg: png },
        { nip: '22222222', prova: 'natacao', rubricaCandidatoSvg: png },
      ],
      [{ nip: '11111111', prova: 'corrida', rubricaCandidatoSvg: webp }],
    );
    expect(out).toHaveLength(2);
    const corrida = out.find((r) => r.prova === 'corrida');
    expect(corrida?.rubricaCandidatoSvg).toBe(webp);
    expect(out.find((r) => r.prova === 'natacao')?.rubricaCandidatoSvg).toBe(png);
  });

  it('pickAplicadorRubricaSvg ignora marcador e vazio', () => {
    expect(
      pickAplicadorRubricaSvg('Rubricado Digitalmente', '', webp, png),
    ).toBe(webp);
    expect(pickAplicadorRubricaSvg(undefined, null)).toBeUndefined();
  });
});
