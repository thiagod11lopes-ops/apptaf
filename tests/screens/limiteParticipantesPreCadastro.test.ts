import { describe, expect, it } from 'vitest';
import { MAX_PRE_CADASTRO_PARTICIPANTES } from '../../src/services/preCadastroTafStorage';
import {
  limiteParticipantesPreCadastro,
  MAX_PARTICIPANTES,
} from '../../src/screens/aplicarTaf/aplicarTafScreenHelpers';

describe('limiteParticipantesPreCadastro', () => {
  it('permite 20 militares em provas com cronômetro (pré-cadastro e identificação direta)', () => {
    expect(MAX_PRE_CADASTRO_PARTICIPANTES).toBe(20);
    expect(limiteParticipantesPreCadastro('corrida')).toBe(20);
    expect(limiteParticipantesPreCadastro('natacao')).toBe(20);
    expect(limiteParticipantesPreCadastro('permanencia')).toBe(20);
    expect(limiteParticipantesPreCadastro('flexao_barra')).toBe(20);
    expect(limiteParticipantesPreCadastro(null)).toBe(20);
  });

  it('mantém o teto maior na caminhada', () => {
    expect(limiteParticipantesPreCadastro('caminhada')).toBe(MAX_PARTICIPANTES);
    expect(MAX_PARTICIPANTES).toBe(200);
  });
});
