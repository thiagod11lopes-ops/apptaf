/** Probe de internet compatível com CORS (GitHub Pages, localhost). */

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

function sameOriginProbeUrl(): string | null {
  if (typeof window === 'undefined' || !window.location?.origin) return null;
  const base = (process.env.EXPO_BASE_URL || '').replace(/\/$/, '');
  const path = base ? `${base}/` : '/';
  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return null;
  }
}

async function fetchProbe(url: string, method: 'HEAD' | 'GET', timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method, cache: 'no-store', signal: ctrl.signal });
    return res.ok;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Verifica conectividade sem fetch cross-origin (evita CORS no console).
 * Usa navigator.onLine + recurso estático do próprio app.
 */
export async function probeInternetReachable(timeoutMs = 4000): Promise<boolean> {
  if (!readNavigatorOnline()) return false;

  const probeUrl = sameOriginProbeUrl();
  if (!probeUrl) return true;

  try {
    if (await fetchProbe(probeUrl, 'HEAD', timeoutMs)) return true;
    return await fetchProbe(probeUrl, 'GET', timeoutMs);
  } catch {
    return false;
  }
}
