import { describe, expect, it } from 'vitest';
import {
  buildDownloadRubricCaches,
  type DownloadRubricCaches,
} from '../../src/offline-first/sync/downloadRubricCache';

describe('buildDownloadRubricCaches', () => {
  it('ignora tombstones e coleções sem rubricas', async () => {
    const caches = await buildDownloadRubricCaches('boss', [
      {
        collection: 'sessoes',
        action: 'download',
        remote: { id: 's1', deleted: true } as never,
      },
      {
        collection: 'aplicadores',
        action: 'download',
        remote: { id: 'a1' } as never,
      },
      {
        collection: 'cadastros',
        action: 'upload',
        remote: { id: 'c1' } as never,
      },
    ]);

    expect(caches.cadastros.size).toBe(0);
    expect(caches.sessoes.size).toBe(0);
  });
});

describe('DownloadRubricCaches shape', () => {
  it('aceita maps vazios', () => {
    const empty: DownloadRubricCaches = {
      cadastros: new Map(),
      sessoes: new Map(),
    };
    expect(empty.cadastros.size + empty.sessoes.size).toBe(0);
  });
});
