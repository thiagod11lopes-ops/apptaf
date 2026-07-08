import { describe, expect, it } from 'vitest';
import { aplicarRubricasEmCadastros } from '../../src/utils/persistirRubricaCadastro';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import type { ResultadoCorridaItem } from '../../src/navigation/types';

const cadastro = (over: Partial<CadastroItemPersist> = {}): CadastroItemPersist => ({
  id: 'c1',
  nip: '12.3456.78',
  nome: 'FULANO DE TAL',
  dataNascimento: '01/01/1990',
  categoria: 'Praças',
  ...over,
});

const resultado = (over: Partial<ResultadoCorridaItem> = {}): ResultadoCorridaItem => ({
  corredor: 1,
  nome: 'FULANO DE TAL',
  tempoMs: 0,
  nip: '12.3456.78',
  ...over,
});

describe('aplicarRubricasEmCadastros', () => {
  it('não altera nada quando não há rúbrica', () => {
    const lista = [cadastro()];
    const out = aplicarRubricasEmCadastros(lista, [resultado()]);
    expect(out[0].rubricaCorridaSvg).toBeUndefined();
  });

  it('aplica a rúbrica na coluna correta por prova (sem mutar o original)', () => {
    const lista = [cadastro()];
    const out = aplicarRubricasEmCadastros(lista, [
      resultado({ prova: 'natacao', rubricaCandidatoSvg: 'data:svg-natacao' }),
    ]);
    expect(out[0].rubricaNatacaoSvg).toBe('data:svg-natacao');
    expect(out[0].rubricaCorridaSvg).toBeUndefined();
    expect(lista[0].rubricaNatacaoSvg).toBeUndefined();
  });

  it('preserva as notas já presentes no buffer ao mesclar a rúbrica', () => {
    const lista = [cadastro({ notaCorrida: '85' })];
    const out = aplicarRubricasEmCadastros(lista, [
      resultado({ prova: 'corrida', rubricaCandidatoSvg: 'data:svg-corrida' }),
    ]);
    expect(out[0].notaCorrida).toBe('85');
    expect(out[0].rubricaCorridaSvg).toBe('data:svg-corrida');
  });

  it('ignora resultado sem cadastro correspondente', () => {
    const lista = [cadastro()];
    const out = aplicarRubricasEmCadastros(lista, [
      resultado({ nip: '99.9999.99', nome: 'OUTRO', rubricaCandidatoSvg: 'data:svg' }),
    ]);
    expect(out[0].rubricaCorridaSvg).toBeUndefined();
  });
});
