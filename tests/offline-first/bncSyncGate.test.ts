import { afterEach, describe, expect, it } from 'vitest';
import { setCloudLinkEnabled } from '../../src/offline-first/sync/cloudLinkPreference';
import { executeLastWriteWinsSync, estimateSyncQueueCounts } from '../../src/offline-first/sync/lastWriteWinsSync';
import { syncManager } from '../../src/offline-first/sync/SyncManager';

describe('etapa 3 — zero sync com BNC off', () => {
  afterEach(() => {
    setCloudLinkEnabled(false);
  });

  it('estimateSyncQueueCounts não consulta nuvem com BNC off', async () => {
    setCloudLinkEnabled(false);
    const estimate = await estimateSyncQueueCounts('owner-bnc-off', true);
    expect(estimate.pendingDownloads).toBe(0);
    expect(estimate.pendingUploads).toBe(0);
  });

  it('executeLastWriteWinsSync aborta com cloud_link_off', async () => {
    setCloudLinkEnabled(false);
    const result = await executeLastWriteWinsSync('owner-bnc-off');
    expect(result.success).toBe(false);
    expect(result.stats.errors).toContain('cloud_link_off');
  });

  it('refreshCloudDiff e startSyncFromToggle não disparam sync com BNC off', async () => {
    setCloudLinkEnabled(false);
    await syncManager.refreshCloudDiff({ forcePull: true });
    const sync = await syncManager.startSyncFromToggle(async () => ({ ok: true }));
    expect(sync.ok).toBe(false);
    expect(sync.error).toMatch(/nuvem|cloud_link|Configurações/i);
  });

  it('awaitCloudAuthoritativeMirror retorna cloud_link_off', async () => {
    setCloudLinkEnabled(false);
    const mirror = await syncManager.awaitCloudAuthoritativeMirror({ timeoutMs: 500, silent: true });
    expect(mirror.ok).toBe(false);
    expect(mirror.error).toBe('cloud_link_off');
  });
});
