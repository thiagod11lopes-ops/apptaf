import { describe, expect, it } from 'vitest';
import {
  enriquecerLinhasComRubricas,
  mesclarRubricasNaLinha,
  type ResultadoTafLinha,
} from '../../src/utils/resultadoTafCadastro';
import { RUBRICADO_DIGITALMENTE } from '../../src/utils/rubricaPresence';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';

function linhaBase(partial: Partial<ResultadoTafLinha> = {}): ResultadoTafLinha {
  return {
    id: 'c1',
    postoGrad: 'MN',
    nip: '12.3456.78',
    nome: 'SILVA',
    notaCorrida: 'REPROVADO',
    situacaoCorrida: 'Reprovado',
    notaCaminhada: '—',
    situacaoCaminhada: '—',
    notaNatacao: '—',
    situacaoNatacao: '—',
    permanenciaTempo: '—',
    situacaoPermanencia: '—',
    rubricaCorridaSvg: RUBRICADO_DIGITALMENTE,
    ...partial,
  };
}

describe('mesclarRubricasNaLinha', () => {
  it('substitui marcador da linha pela imagem da side table', () => {
    const img = 'data:image/png;base64,AAA';
    const out = mesclarRubricasNaLinha(linhaBase(), { corrida: img });
    expect(out.rubricaCorridaSvg).toBe(img);
  });

  it('mantém imagem já presente na linha', () => {
    const img = 'data:image/webp;base64,BBB';
    const out = mesclarRubricasNaLinha(linhaBase({ rubricaCorridaSvg: img }), {
      corrida: RUBRICADO_DIGITALMENTE,
    });
    expect(out.rubricaCorridaSvg).toBe(img);
  });
});

describe('enriquecerLinhasComRubricas', () => {
  it('usa rúbricas do mapa de cadastros (side table) sobre marcador light', () => {
    const img = 'data:image/png;base64,CCC';
    const cadastros: CadastroItemPersist[] = [
      {
        id: 'c1',
        nip: '12.3456.78',
        nome: 'SILVA',
        dataNascimento: '01/01/1990',
        categoria: 'Praças',
        rubricaCorridaSvg: RUBRICADO_DIGITALMENTE,
      },
    ];
    const rubCad = new Map([['c1', { corrida: img }]]);
    const out = enriquecerLinhasComRubricas([linhaBase()], cadastros, undefined, rubCad);
    expect(out[0]?.rubricaCorridaSvg).toBe(img);
  });
});
