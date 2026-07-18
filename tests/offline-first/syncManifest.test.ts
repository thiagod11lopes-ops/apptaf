import { describe, expect, it } from 'vitest';
import {
  buildSyncManifest,
  buildSyncPlanFromManifest,
} from '../../src/offline-first/sync/syncManifest';

describe('SyncManifest / SyncPlan (7.0)', () => {
  it('somente local → upload; somente remoto → download; iguais → ignore', () => {
    const manifest = buildSyncManifest(
      'cadastros',
      [
        { id: 'a', updatedAt: 100, syncVersion: 2, deleted: false },
        { id: 'same', updatedAt: 50, syncVersion: 1, deleted: false },
      ],
      [
        { id: 'b', updatedAt: 200, syncVersion: 3, deleted: false },
        { id: 'same', updatedAt: 50, syncVersion: 1, deleted: false },
      ],
    );
    const plan = buildSyncPlanFromManifest(manifest);

    expect(plan.upload.some((i) => i.id === 'a')).toBe(true);
    expect(plan.download.some((i) => i.id === 'b')).toBe(true);
    expect(plan.ignore.some((i) => i.id === 'same')).toBe(true);
  });

  it('local mais novo → upload; remoto mais novo → download', () => {
    const manifest = buildSyncManifest(
      'cadastros',
      [
        { id: 'x', updatedAt: 300, syncVersion: 5, deleted: false },
        { id: 'y', updatedAt: 100, syncVersion: 2, deleted: false },
      ],
      [
        { id: 'x', updatedAt: 200, syncVersion: 4, deleted: false },
        { id: 'y', updatedAt: 400, syncVersion: 6, deleted: false },
      ],
    );
    const plan = buildSyncPlanFromManifest(manifest);
    expect(plan.upload.find((i) => i.id === 'x')).toBeTruthy();
    expect(plan.download.find((i) => i.id === 'y')).toBeTruthy();
  });

  it('merge sem perda — ids distintos em upload e download', () => {
    const local = Array.from({ length: 5 }, (_, i) => ({
      id: `L${i}`,
      updatedAt: 10,
      syncVersion: 1,
      deleted: false,
    }));
    const remote = Array.from({ length: 5 }, (_, i) => ({
      id: `R${i}`,
      updatedAt: 10,
      syncVersion: 1,
      deleted: false,
    }));
    const plan = buildSyncPlanFromManifest(buildSyncManifest('cadastros', local, remote));
    expect(plan.upload).toHaveLength(5);
    expect(plan.download).toHaveLength(5);
  });
});
