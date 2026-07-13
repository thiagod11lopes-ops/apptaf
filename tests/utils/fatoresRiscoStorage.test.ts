import { describe, expect, it } from 'vitest';
import {
  listarFatoresRiscoSim,
  respostasFatoresVazias,
  temFatorRiscoSim,
} from '../../src/services/fatoresRiscoStorage';

describe('fatoresRiscoStorage helpers', () => {
  it('detecta quando há pelo menos um Sim', () => {
    const respostas = respostasFatoresVazias();
    expect(temFatorRiscoSim(respostas)).toBe(false);
    respostas.diabetes = 'sim';
    expect(temFatorRiscoSim(respostas)).toBe(true);
  });

  it('lista apenas os rótulos marcados com Sim', () => {
    const respostas = respostasFatoresVazias();
    respostas.hipertensao = 'sim';
    respostas.tabagismo = 'nao';
    respostas.apneiaSono = 'sim';
    expect(listarFatoresRiscoSim(respostas)).toEqual(['Hipertensão', 'Apnéia do sono']);
  });
});
