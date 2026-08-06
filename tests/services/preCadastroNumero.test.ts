import { describe, expect, it } from 'vitest';
import {
  atribuirNumerosLegadoPorCriacao,
  proximoNumeroPreCadastro,
  sortPreCadastrosPorNumero,
} from '../../src/services/preCadastroTafStorage';

describe('numeração de pré-cadastros', () => {
  it('próximo número é 1 se a lista estiver vazia', () => {
    expect(proximoNumeroPreCadastro([])).toBe(1);
  });

  it('próximo número é max + 1 (não reaproveita buracos)', () => {
    expect(proximoNumeroPreCadastro([{ numero: 1 }, { numero: 2 }])).toBe(3);
    expect(proximoNumeroPreCadastro([{ numero: 2 }])).toBe(3);
  });

  it('ordena do menor número para o maior (novos embaixo)', () => {
    const sorted = sortPreCadastrosPorNumero([
      { numero: 3, criadoEm: 300 },
      { numero: 1, criadoEm: 100 },
      { numero: 2, criadoEm: 200 },
    ]);
    expect(sorted.map((x) => x.numero)).toEqual([1, 2, 3]);
  });

  it('legado sem número: atribui 1..N por ordem de criação', () => {
    const migrados = atribuirNumerosLegadoPorCriacao([
      { id: 'b', criadoEm: 200 },
      { id: 'a', criadoEm: 100 },
      { id: 'c', criadoEm: 300 },
    ]);
    const byId = Object.fromEntries(migrados.map((m) => [m.id, m.numero]));
    expect(byId).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('não altera números já persistidos', () => {
    const migrados = atribuirNumerosLegadoPorCriacao([
      { id: 'x', criadoEm: 50, numero: 7 },
      { id: 'y', criadoEm: 10 },
    ]);
    expect(migrados.find((m) => m.id === 'x')?.numero).toBe(7);
    expect(migrados.find((m) => m.id === 'y')?.numero).toBe(8);
  });
});
