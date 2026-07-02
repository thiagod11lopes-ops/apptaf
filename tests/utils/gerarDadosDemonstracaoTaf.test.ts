import { describe, expect, it } from 'vitest';
import { calcularIdadeAnos } from '../../src/utils/calcularIdade';
import {
  DEMO_IDADE_MAX,
  DEMO_IDADE_MIN,
  DEMO_PCT_COMPLETO,
  DEMO_TOTAL_CFN,
  DEMO_TOTAL_FEMININO,
  DEMO_TOTAL_MILITARES,
  gerarDadosDemonstracaoTaf,
} from '../../src/utils/gerarDadosDemonstracaoTaf';

const DEMO_REFERENCIA_IDADE = new Date(2026, 6, 1);

describe('gerarDadosDemonstracaoTaf', () => {
  it('gera 50 cadastros com 10 FN e 20 mulheres', () => {
    const { cadastros, sessoes, stats } = gerarDadosDemonstracaoTaf();

    expect(cadastros).toHaveLength(DEMO_TOTAL_MILITARES);
    expect(sessoes.length).toBeGreaterThan(0);
    expect(stats.total).toBe(DEMO_TOTAL_MILITARES);
    expect(stats.cfn).toBe(DEMO_TOTAL_CFN);
    expect(stats.feminino).toBe(DEMO_TOTAL_FEMININO);
    expect(stats.completos / stats.total).toBeGreaterThan(DEMO_PCT_COMPLETO - 0.08);
  });

  it('escala perfil proporcionalmente para outros totais', () => {
    const { stats } = gerarDadosDemonstracaoTaf(500);

    expect(stats.total).toBe(500);
    expect(stats.cfn).toBe(100);
    expect(stats.feminino).toBe(200);
  });

  it('cadastros com idade entre 18 e 50 anos na referência do TAF demo', () => {
    const { cadastros } = gerarDadosDemonstracaoTaf();

    for (const c of cadastros) {
      const idade = calcularIdadeAnos(c.dataNascimento, DEMO_REFERENCIA_IDADE);
      expect(idade).toBeGreaterThanOrEqual(DEMO_IDADE_MIN);
      expect(idade).toBeLessThanOrEqual(DEMO_IDADE_MAX);
    }
  });

  it('datas de julho a setembro de 2026', () => {
    const { cadastros } = gerarDadosDemonstracaoTaf(120);
    const datas = cadastros
      .flatMap((c) => [
        c.dataTafCorrida,
        c.dataTafNatacao,
        c.dataTafCaminhada,
        c.dataTafPermanencia,
        c.dataTafFlexaoBarra,
      ])
      .filter(Boolean) as string[];

    expect(datas.length).toBeGreaterThan(0);
    for (const d of datas) {
      const [, mes, ano] = d.split('/');
      expect(ano).toBe('2026');
      expect(['07', '08', '09']).toContain(mes);
    }
  });
});
