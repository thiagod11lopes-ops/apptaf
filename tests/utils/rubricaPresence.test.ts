import { describe, expect, it } from 'vitest';
import {
  isRubricaImagemDataUrl,
  paraMarcadorRubrica,
  preferRubrica,
  RUBRICADO_DIGITALMENTE,
  temRubricaPresente,
} from '../../src/utils/rubricaPresence';
import { toSessaoLight } from '../../src/utils/sessaoLight';
import type { SessaoAplicacaoTaf } from '../../src/services/resultadosAplicadosIndexedDb';

describe('rubricaPresence', () => {
  it('detecta imagem e marcador', () => {
    expect(isRubricaImagemDataUrl('data:image/webp;base64,AAA')).toBe(true);
    expect(isRubricaImagemDataUrl(RUBRICADO_DIGITALMENTE)).toBe(false);
    expect(temRubricaPresente(RUBRICADO_DIGITALMENTE)).toBe(true);
    expect(temRubricaPresente('data:image/png;base64,AAA')).toBe(true);
    expect(temRubricaPresente('')).toBe(false);
  });

  it('converte imagem em marcador', () => {
    expect(paraMarcadorRubrica('data:image/webp;base64,AAA')).toBe(RUBRICADO_DIGITALMENTE);
    expect(paraMarcadorRubrica(RUBRICADO_DIGITALMENTE)).toBe(RUBRICADO_DIGITALMENTE);
    expect(paraMarcadorRubrica(undefined)).toBeUndefined();
  });

  it('preferRubrica prioriza imagem sobre marcador', () => {
    expect(preferRubrica(RUBRICADO_DIGITALMENTE, 'data:image/png;base64,AAA')).toBe(
      'data:image/png;base64,AAA',
    );
    expect(preferRubrica('data:image/webp;base64,BBB', RUBRICADO_DIGITALMENTE)).toBe(
      'data:image/webp;base64,BBB',
    );
    expect(preferRubrica(RUBRICADO_DIGITALMENTE, undefined)).toBe(RUBRICADO_DIGITALMENTE);
    expect(preferRubrica(undefined, undefined)).toBeUndefined();
  });

  it('toSessaoLight troca imagens por marcador', () => {
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
      aplicadorAssinatura: {
        aplicadorId: 'a1',
        nome: 'App',
        nip: '22.2222.22',
        rubricaSvg: 'data:image/webp;base64,BBB',
      },
    } as SessaoAplicacaoTaf;

    const light = toSessaoLight(sessao);
    expect(light.resultados[0]?.rubricaCandidatoSvg).toBe(RUBRICADO_DIGITALMENTE);
    expect(light.aplicadorAssinatura?.rubricaSvg).toBe(RUBRICADO_DIGITALMENTE);
  });
});
