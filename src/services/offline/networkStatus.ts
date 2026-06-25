import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { probeInternetReachable } from '../../utils/probeInternetReachable';

type OnlineListener = (online: boolean) => void;

const listeners = new Set<OnlineListener>();
let windowEventsBound = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reachabilityTimer: ReturnType<typeof setInterval> | null = null;
let lastReachable = true;
let reachabilityInFlight = false;

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

async function probeInternetReachableLocal(): Promise<boolean> {
  return probeInternetReachable(3500);
}

function computeOnlineState(reachable: boolean): boolean {
  return readNavigatorOnline() && reachable;
}

function notifyAll(online: boolean): void {
  listeners.forEach((fn) => fn(online));
}

async function refreshReachability(): Promise<void> {
  if (reachabilityInFlight) return;
  reachabilityInFlight = true;
  try {
    const reachable = await probeInternetReachableLocal();
    if (reachable !== lastReachable) {
      lastReachable = reachable;
      notifyAll(computeOnlineState(reachable));
    } else if (!readNavigatorOnline()) {
      notifyAll(false);
    }
  } finally {
    reachabilityInFlight = false;
  }
}

function syncOnlineFromNavigator(): void {
  if (!readNavigatorOnline()) {
    lastReachable = false;
    notifyAll(false);
    return;
  }
  void refreshReachability();
}

function ensureWindowEvents(): void {
  if (windowEventsBound) return;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;

  windowEventsBound = true;
  window.addEventListener('online', syncOnlineFromNavigator);
  window.addEventListener('offline', syncOnlineFromNavigator);

  if (pollTimer == null) {
    pollTimer = setInterval(syncOnlineFromNavigator, 1500);
  }

  if (reachabilityTimer == null) {
    reachabilityTimer = setInterval(() => {
      if (readNavigatorOnline()) void refreshReachability();
    }, 5000);
  }
}

export function isOnline(): boolean {
  return computeOnlineState(lastReachable);
}

/** Tenta Firebase quando o navegador reporta online (evita falso offline do probe de rede). */
export function canAttemptCloudSync(): boolean {
  return readNavigatorOnline();
}

export function subscribeOnlineStatus(listener: OnlineListener): () => void {
  listeners.add(listener);
  ensureWindowEvents();
  listener(computeOnlineState(lastReachable));
  void refreshReachability().then(() => {
    listener(computeOnlineState(lastReachable));
  });

  return () => {
    listeners.delete(listener);
  };
}

export function useNetworkOnline(): boolean {
  const [online, setOnline] = useState(() => computeOnlineState(lastReachable));

  useEffect(() => {
    return subscribeOnlineStatus(setOnline);
  }, []);

  return online;
}

export function pingNetworkStatus(): void {
  syncOnlineFromNavigator();
}
