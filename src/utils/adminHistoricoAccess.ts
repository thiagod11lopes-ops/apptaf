import { Platform } from 'react-native';

/** Caminhos e parâmetros que abrem o painel admin do histórico (web). */
export const ADMIN_HISTORICO_PATH = '/admin/historico';
export const ADMIN_HISTORICO_HASH = '#/admin/historico';
export const ADMIN_HISTORICO_QUERY = 'admin=historico';

export function isAdminHistoricoAccess(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;

  const { pathname, hash, search } = window.location;
  const path = pathname.toLowerCase();
  if (path === ADMIN_HISTORICO_PATH || path.endsWith(`${ADMIN_HISTORICO_PATH}/`)) return true;
  if (hash.toLowerCase().includes('admin/historico')) return true;
  if (new URLSearchParams(search).get('admin') === 'historico') return true;
  return false;
}

export function adminHistoricoEntryUrls(origin = ''): string[] {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  return [
    `${base}${ADMIN_HISTORICO_PATH}`,
    `${base}/?${ADMIN_HISTORICO_QUERY}`,
    `${base}${ADMIN_HISTORICO_HASH}`,
  ];
}
