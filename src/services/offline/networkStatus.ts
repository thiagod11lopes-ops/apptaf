import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

type OnlineListener = (online: boolean) => void;

const listeners = new Set<OnlineListener>();
let windowEventsBound = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

function notifyAll(online: boolean): void {
  listeners.forEach((fn) => fn(online));
}

function syncOnlineFromNavigator(): void {
  notifyAll(readNavigatorOnline());
}

function ensureWindowEvents(): void {
  if (windowEventsBound) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  windowEventsBound = true;
  window.addEventListener('online', syncOnlineFromNavigator);
  window.addEventListener('offline', syncOnlineFromNavigator);

  if (pollTimer == null) {
    pollTimer = setInterval(syncOnlineFromNavigator, 2000);
  }
}

export function isOnline(): boolean {
  return readNavigatorOnline();
}

export function subscribeOnlineStatus(listener: OnlineListener): () => void {
  listeners.add(listener);
  ensureWindowEvents();
  listener(readNavigatorOnline());

  return () => {
    listeners.delete(listener);
  };
}

/** Hook reativo — reflete `navigator.onLine` e eventos online/offline (web). */
export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(() => readNavigatorOnline());

  useEffect(() => {
    return subscribeOnlineStatus(setOnline);
  }, []);

  return online;
}
