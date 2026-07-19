import { Platform } from 'react-native';

/** Caminhos e parâmetros que abrem o painel admin do histórico (web). */
export const ADMIN_HISTORICO_PATH = '/admin/historico';
export const ADMIN_HISTORICO_HASH = '#/admin/historico';
export const ADMIN_HISTORICO_QUERY = 'admin=historico';

/** Prefixo do deploy (ex.: `/apptaf` no GitHub Pages). */
export function webAppBasePath(): string {
  if (typeof window === 'undefined') return '';
  const path = window.location.pathname;
  if (path === '/apptaf' || path.startsWith('/apptaf/')) return '/apptaf';
  return '';
}

export function isAdminHistoricoAccess(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const { pathname, hash, search } = window.location;
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path === ADMIN_HISTORICO_PATH || path.endsWith(ADMIN_HISTORICO_PATH)) return true;
  if (hash.toLowerCase().includes('admin/historico')) return true;
  if (new URLSearchParams(search).get('admin') === 'historico') return true;
  return false;
}

export function adminHistoricoEntryUrls(origin = ''): string[] {
  const originBase = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  const basePath = webAppBasePath();
  return [
    `${originBase}${basePath}${ADMIN_HISTORICO_PATH}`,
    `${originBase}${basePath}/?${ADMIN_HISTORICO_QUERY}`,
    `${originBase}${basePath}/${ADMIN_HISTORICO_HASH}`,
  ];
}
