import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeInternetReachable } from '../../src/utils/probeInternetReachable';

describe('probeInternetReachable', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retorna false quando navigator.onLine é false', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(probeInternetReachable()).resolves.toBe(false);
  });

  it('usa index same-origin sem URL externa (sem CORS)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      location: { origin: 'https://thiagod11lopes-ops.github.io' },
    });
    process.env.EXPO_BASE_URL = '/apptaf';

    await expect(probeInternetReachable()).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalled();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('thiagod11lopes-ops.github.io');
    expect(url).toContain('/apptaf/');
    expect(url).not.toContain('gstatic.com');
  });

  it('retorna false quando fetch same-origin falha (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('window', {
      location: { origin: 'https://thiagod11lopes-ops.github.io' },
    });
    process.env.EXPO_BASE_URL = '/apptaf';

    await expect(probeInternetReachable()).resolves.toBe(false);
  });
});
