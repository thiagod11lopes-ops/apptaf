import { describe, expect, it } from 'vitest';
import {
  cadastroIncompletoNascimentoOuFatores,
  contarCadastrosIncompletosNascimentoOuFatores,
  fatoresRiscoRegistroPreenchido,
} from '../../src/utils/cadastroIncompleto';
import { respostasFatoresVazias, type FatoresRiscoRegistro } from '../../src/services/fatoresRiscoStorage';

function reg(over: Partial<FatoresRiscoRegistro> = {}): FatoresRiscoRegistro {
  return {
    nip: '11111111',
    nome: 'Teste',
    respostas: {
      hipertensao: 'nao',
      diabetes: 'nao',
      dislipidemia: 'nao',
      tabagismo: 'nao',
      sedentarismo: 'nao',
      apneiaSono: 'nao',
      morteSubitaFamilia: 'nao',
    },
    updatedAt: 1,
    ...over,
  };
}

describe('cadastroIncompleto', () => {
  it('fatores preenchidos exige Sim/Não em todos os itens', () => {
    expect(fatoresRiscoRegistroPreenchido(reg())).toBe(true);
    expect(fatoresRiscoRegistroPreenchido(reg({ respostas: respostasFatoresVazias() }))).toBe(
      false,
    );
    expect(fatoresRiscoRegistroPreenchido(null)).toBe(false);
  });

  it('conta incompletos quando falta nascimento, fatores ou ambos', () => {
    const comFatores = new Set(['11111111']);
    expect(
      cadastroIncompletoNascimentoOuFatores(
        { nip: '11.1111.11', dataNascimento: '01/01/1990' },
        comFatores,
      ),
    ).toBe(false);
    expect(
      cadastroIncompletoNascimentoOuFatores(
        { nip: '11.1111.11', dataNascimento: '' },
        comFatores,
      ),
    ).toBe(true);
    expect(
      cadastroIncompletoNascimentoOuFatores(
        { nip: '11.1111.11', dataNascimento: '01/01/1990' },
        new Set(),
      ),
    ).toBe(true);
    expect(
      contarCadastrosIncompletosNascimentoOuFatores(
        [
          { nip: '11.1111.11', dataNascimento: '01/01/1990' },
          { nip: '22.2222.22', dataNascimento: '' },
          { nip: '33.3333.33', dataNascimento: '02/02/1992' },
        ],
        new Set(['11111111']),
      ),
    ).toBe(2);
  });
});
