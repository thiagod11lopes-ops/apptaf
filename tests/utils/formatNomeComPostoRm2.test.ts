import { describe, expect, it } from 'vitest';
import {
  formatNomeComPosto,
  formatNomeComPostoParts,
  postoGradComVinculo,
  primeiroSegundoNomeComPosto,
} from '../../src/utils/formatNomeComPosto';
import { postoGradFromCadastro } from '../../src/utils/resultadoTafCadastro';

describe('RM2 ao lado do posto/graduação', () => {
  it('postoGradComVinculo anexa RM2 com espaço', () => {
    expect(postoGradComVinculo('CB', 'rm2')).toBe('CB RM2');
    expect(postoGradComVinculo('CT', 'carreira')).toBe('CT');
    expect(postoGradComVinculo('CB', 'rm2')).not.toBe('CBRM2');
  });

  it('formatNomeComPosto inclui RM2 entre posto e nome', () => {
    expect(
      formatNomeComPosto({
        nome: 'Silva',
        categoria: 'Praças',
        praca: 'CB',
        vinculo: 'rm2',
      }),
    ).toBe('CB RM2 Silva');
  });

  it('postoGradFromCadastro respeita vinculo rm2', () => {
    expect(
      postoGradFromCadastro({
        categoria: 'Praças',
        praca: '3°SG',
        vinculo: 'rm2',
      }),
    ).toBe('3°SG RM2');
  });

  it('formatNomeComPostoParts com posto já com RM2', () => {
    expect(formatNomeComPostoParts('CB RM2', 'João')).toBe('CB RM2 João');
  });

  it('primeiroSegundoNomeComPosto preserva RM2', () => {
    expect(primeiroSegundoNomeComPosto('CB RM2 João Silva Santos')).toBe('CB RM2 João Silva');
  });
});
