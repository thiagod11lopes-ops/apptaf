import { describe, expect, it } from 'vitest';
import {
  isNomeCodigoPreCadastro,
  nomesCodigoDisponiveis,
  NOMES_CODIGO_PRE_CADASTRO,
} from '../../src/services/preCadastroTafStorage';

describe('nomeCodigo pré-cadastro', () => {
  it('reconhece Alfa…Zulu', () => {
    expect(isNomeCodigoPreCadastro('Alfa')).toBe(true);
    expect(isNomeCodigoPreCadastro('Zulu')).toBe(true);
    expect(isNomeCodigoPreCadastro('Alpha')).toBe(false);
  });

  it('exclui nomes já em uso', () => {
    const livres = nomesCodigoDisponiveis([{ nomeCodigo: 'Alfa' }, { nomeCodigo: 'Bravo' }]);
    expect(livres).not.toContain('Alfa');
    expect(livres).not.toContain('Bravo');
    expect(livres[0]).toBe('Charlie');
    expect(livres.length).toBe(NOMES_CODIGO_PRE_CADASTRO.length - 2);
  });
});
