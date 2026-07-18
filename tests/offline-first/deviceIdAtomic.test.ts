import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { removeAppMeta, resetAppMetaCacheForTests, writeAppMeta } from '../../src/offline-first/db/appMeta';
import {
  getDeviceId,
  peekDeviceId,
  resetDeviceIdCacheForTests,
} from '../../src/offline-first/deviceId';

describe('getDeviceId — geração atômica', () => {
  beforeEach(() => {
    resetDeviceIdCacheForTests();
    resetAppMetaCacheForTests();
  });

  afterEach(() => {
    resetDeviceIdCacheForTests();
    resetAppMetaCacheForTests();
    vi.restoreAllMocks();
  });

  it('duas chamadas simultâneas retornam exatamente o mesmo deviceId', async () => {
    const [a, b] = await Promise.all([getDeviceId(), getDeviceId()]);
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
    expect(peekDeviceId()).toBe(a);
  });

  it('várias chamadas simultâneas retornam exatamente o mesmo deviceId', async () => {
    const results = await Promise.all([
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
      getDeviceId(),
    ]);
    const first = results[0];
    expect(results.every((id) => id === first)).toBe(true);
    expect(peekDeviceId()).toBe(first);
  });

  it('após o cache estar carregado, chamadas seguintes reutilizam o mesmo valor', async () => {
    const first = await getDeviceId();
    const second = await getDeviceId();
    const third = await getDeviceId();
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(peekDeviceId()).toBe(first);
  });

  it('preserva deviceId já existente no appMeta sem gerar outro', async () => {
    await writeAppMeta('device:id', 'device-already-persisted');
    resetDeviceIdCacheForTests();

    const [a, b] = await Promise.all([getDeviceId(), getDeviceId()]);
    expect(a).toBe('device-already-persisted');
    expect(b).toBe('device-already-persisted');
  });

  it('peekDeviceId retorna null antes da primeira resolução e o id depois', async () => {
    expect(peekDeviceId()).toBeNull();
    const id = await getDeviceId();
    expect(peekDeviceId()).toBe(id);
  });

  it('gera novo id quando não há cache nem meta', async () => {
    await removeAppMeta('device:id');
    resetDeviceIdCacheForTests();
    resetAppMetaCacheForTests();

    const id = await getDeviceId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    // UUID ou fallback dev-…
    expect(id.includes('-')).toBe(true);
  });
});
