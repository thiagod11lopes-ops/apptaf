import { Platform } from 'react-native';

type OnlineListener = (online: boolean) => void;

const listeners = new Set<OnlineListener>();

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function isOnline(): boolean {
  return readNavigatorOnline();
}

export function subscribeOnlineStatus(listener: OnlineListener): () => void {
  listeners.add(listener);

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const onOnline = () => {
      listeners.forEach((fn) => fn(true));
    };
    const onOffline = () => {
      listeners.forEach((fn) => fn(false));
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }

  return () => listeners.delete(listener);
}
