import { describe, expect, it } from 'vitest';
import {
  DEMO_PCT_CFN,
  DEMO_PCT_COMPLETO,
  DEMO_PCT_FEMININO,
  DEMO_TOTAL_MILITARES,
  gerarDadosDemonstracaoTaf,
} from '../../src/utils/gerarDadosDemonstracaoTaf';

describe('gerarDadosDemonstracaoTaf', () => {
  it('gera 2243 cadastros com perfil pedido', () => {
    const { cadastros, sessoes, stats } = gerarDadosDemonstracaoTaf(500);

    expect(cadastros).toHaveLength(500);
    expect(sessoes.length).toBeGreaterThan(0);
    expect(stats.total).toBe(500);
    expect(stats.feminino / stats.total).toBeGreaterThan(DEMO_PCT_FEMININO - 0.08);
    expect(stats.cfn / stats.total).toBeGreaterThan(DEMO_PCT_CFN - 0.08);
    expect(stats.completos / stats.total).toBeGreaterThan(DEMO_PCT_COMPLETO - 0.08);
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

  it('escala para total padrão', () => {
    const { stats } = gerarDadosDemonstracaoTaf(DEMO_TOTAL_MILITARES);
    expect(stats.total).toBe(DEMO_TOTAL_MILITARES);
  });
});
