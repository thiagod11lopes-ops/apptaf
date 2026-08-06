import { describe, expect, it } from 'vitest';
import { mergeCadastroRubricasFields } from '../../src/utils/cadastroLight';

const png = 'data:image/png;base64,AAA';
const webp = 'data:image/webp;base64,BBB';

describe('mergeCadastroRubricasFields', () => {
  it('preserva modalidades do fallback quando primary omite', () => {
    const out = mergeCadastroRubricasFields(
      {
        rubricaCorridaSvg: png,
        rubricaNatacaoSvg: png,
      },
      {
        rubricaCaminhadaSvg: webp,
      },
    );
    expect(out.rubricaCorridaSvg).toBe(png);
    expect(out.rubricaNatacaoSvg).toBe(png);
    expect(out.rubricaCaminhadaSvg).toBe(webp);
    expect(out.rubricaPermanenciaSvg).toBeUndefined();
  });

  it('primary com imagem vence marcador/ausência no fallback', () => {
    const out = mergeCadastroRubricasFields(
      { rubricaCorridaSvg: png },
      { rubricaCorridaSvg: webp },
    );
    expect(out.rubricaCorridaSvg).toBe(webp);
  });

  it('ignora texto de marcador (não é imagem)', () => {
    const out = mergeCadastroRubricasFields(
      { rubricaCorridaSvg: png },
      { rubricaCorridaSvg: 'Rubricado Digitalmente' },
    );
    expect(out.rubricaCorridaSvg).toBe(png);
  });
});
