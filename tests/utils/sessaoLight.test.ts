import { describe, expect, it } from 'vitest';
import { normalizeSessaoShape, toSessaoLight } from '../../src/utils/sessaoLight';

describe('sessaoLight', () => {
  it('normaliza sessão sem resultados (tombstone/light do Firestore)', () => {
    const normalized = normalizeSessaoShape({
      id: 's1',
      criadoEm: '2026-01-01T00:00:00.000Z',
      dataAplicacao: '01/01/2026',
      tipoProva: 'corrida',
    });

    expect(normalized.resultados).toEqual([]);
    expect(toSessaoLight(normalized).resultados).toEqual([]);
  });

  it('preserva resultados quando presentes', () => {
    const normalized = normalizeSessaoShape({
      id: 's2',
      criadoEm: '2026-01-01T00:00:00.000Z',
      dataAplicacao: '01/01/2026',
      tipoProva: 'corrida',
      resultados: [{ nip: '12345678', nome: 'Teste', nota: '10' }],
    });

    expect(normalized.resultados).toHaveLength(1);
    expect(toSessaoLight(normalized).resultados[0]?.nip).toBe('12345678');
  });
});
