import { describe, expect, it } from 'vitest';
import {
  listarFatoresRiscoSim,
  respostasFatoresVazias,
  temFatorRiscoSim,
} from '../../src/services/fatoresRiscoStorage';
import { calcularImc, classificarImc } from '../../src/utils/imcFatoresRisco';

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

describe('calcularImc / classificarImc', () => {
  it('classifica as faixas com as cores esperadas', () => {
    expect(classificarImc(17).titulo).toBe('Abaixo do peso');
    expect(classificarImc(17).cor).toBe('azul');
    expect(classificarImc(22).titulo).toBe('Peso normal');
    expect(classificarImc(22).cor).toBe('azul');
    expect(classificarImc(27).titulo).toBe('Sobrepeso');
    expect(classificarImc(27).cor).toBe('laranja');
    expect(classificarImc(32).titulo).toBe('Obesidade Grau I');
    expect(classificarImc(32).cor).toBe('vermelho');
    expect(classificarImc(37).titulo).toBe('Obesidade Grau II');
    expect(classificarImc(37).cor).toBe('vermelho');
    expect(classificarImc(42).titulo).toBe('Obesidade Grau III');
    expect(classificarImc(42).cor).toBe('vermelho');
  });

  it('calcula IMC a partir de altura em metros ou cm', () => {
    const emMetros = calcularImc('1,75', '70');
    const emCm = calcularImc('175', '70');
    expect(emMetros?.imcFormatado).toBe(emCm?.imcFormatado);
    expect(emMetros?.classificacao.titulo).toBe('Peso normal');
  });
});
