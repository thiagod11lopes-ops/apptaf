import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOwnerDocsByIds = vi.fn(async () => new Map());
const listOwnerDocs = vi.fn(async () => []);

vi.mock('../../src/services/supabase/ownerDocs', () => ({
  getOwnerDoc: vi.fn(async () => null),
  getOwnerDocsByIds: (...args: unknown[]) => getOwnerDocsByIds(...args),
  listOwnerDocs: (...args: unknown[]) => listOwnerDocs(...args),
  deleteOwnerDoc: vi.fn(async () => undefined),
  upsertOwnerDoc: vi.fn(async () => undefined),
  rowToDoc: (row: { id: string; data?: Record<string, unknown> }) => ({
    id: row.id,
    ...(row.data ?? {}),
  }),
}));

import { fetchCadastroRubricasForIds } from '../../src/services/supabase/cadastroRubricasCloud';
import { fetchSessaoRubricasForIds } from '../../src/services/supabase/sessaoRubricasCloud';

describe('fetch*RubricasForIds — sem full scan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOwnerDocsByIds.mockResolvedValue(
      new Map([
        [
          'a',
          {
            id: 'a',
            owner_uid: 'o',
            updated_at: 1,
            data: { rubricaCorridaSvg: 'data:image/png;base64,AA' },
          },
        ],
      ]),
    );
  });

  it('cadastro: usa getOwnerDocsByIds mesmo com muitos ids', async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `id-${i}`);
    await fetchCadastroRubricasForIds('owner-1', ids);
    expect(getOwnerDocsByIds).toHaveBeenCalled();
    expect(listOwnerDocs).not.toHaveBeenCalled();
  });

  it('sessão: usa getOwnerDocsByIds mesmo com muitos ids', async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `sess-${i}`);
    await fetchSessaoRubricasForIds('owner-1', ids);
    expect(getOwnerDocsByIds).toHaveBeenCalled();
    expect(listOwnerDocs).not.toHaveBeenCalled();
  });
});
