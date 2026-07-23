import { describe, expect, it } from 'vitest';
import { dedupeAplicadoresByNipNewest } from '../../src/services/offline/conflictMerge';
import type { AplicadorItemPersist } from '../../src/services/aplicadoresIndexedDb';

function aplicador(
  partial: Partial<AplicadorItemPersist> & Pick<AplicadorItemPersist, 'id' | 'nip' | 'nome'>,
): AplicadorItemPersist {
  return {
    categoria: 'Praças',
    praca: 'MN',
    senhaHash: 'x',
    ...partial,
  };
}

describe('dedupeAplicadoresByNipNewest', () => {
  it('mantém o aplicador mais recente para o mesmo NIP', () => {
    const out = dedupeAplicadoresByNipNewest([
      aplicador({ id: 'old', nip: '06.0380.85', nome: 'Antigo', updatedAt: 100 }),
      aplicador({ id: 'new', nip: '06038085', nome: 'Novo', updatedAt: 200 }),
      aplicador({ id: 'other', nip: '11.1111.11', nome: 'Outro', updatedAt: 50 }),
    ]);
    expect(out).toHaveLength(2);
    expect(out.find((a) => a.nip.includes('0380') || a.nip.includes('06038085'))?.id).toBe('new');
    expect(out.find((a) => a.id === 'other')).toBeTruthy();
  });

  it('não remove aplicadores sem NIP válido', () => {
    const out = dedupeAplicadoresByNipNewest([
      aplicador({ id: 'a', nip: '', nome: 'Sem Nip A', updatedAt: 1 }),
      aplicador({ id: 'b', nip: '', nome: 'Sem Nip B', updatedAt: 2 }),
    ]);
    expect(out).toHaveLength(2);
  });
});
