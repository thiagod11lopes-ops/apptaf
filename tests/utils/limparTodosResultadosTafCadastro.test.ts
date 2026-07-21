import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import {
  cadastroTemResultadoTaf,
  limparTodosResultadosTafCadastro,
} from '../../src/utils/limparResultadoModalidade';

function baseCadastro(): CadastroItemPersist {
  return {
    id: 'c1',
    nome: 'Militar Teste',
    nip: '12345678',
    updatedAt: Date.now(),
  };
}

describe('limparTodosResultadosTafCadastro', () => {
  it('remove resultados de todas as modalidades e mantém dados pessoais', () => {
    const c: CadastroItemPersist = {
      ...baseCadastro(),
      tempoCorrida: '12:30',
      notaCorrida: '10',
      tempoNatacao: '08:00',
      resultadoNatacao: 'aprovado',
      tempoPermanencia: '02:00',
      resultadoPermanencia: 'aprovado',
      tempoCaminhada: '40:00',
      notaCaminhada: '8',
      modalidadeDistanciaAtiva: 'corrida',
    };
    expect(cadastroTemResultadoTaf(c)).toBe(true);
    const limpo = limparTodosResultadosTafCadastro(c);
    expect(cadastroTemResultadoTaf(limpo)).toBe(false);
    expect(limpo.nome).toBe('Militar Teste');
    expect(limpo.nip).toBe('12345678');
  });
});
