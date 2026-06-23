import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

type OnlineListener = (online: boolean) => void;

const listeners = new Set<OnlineListener>();
let windowEventsBound = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let reachabilityTimer: ReturnType<typeof setInterval> | null = null;
let lastReachable = true;
let reachabilityInFlight = false;

const REACHABILITY_URL = 'https://connectivitycheck.gstatic.com/generate_204';

function readNavigatorOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

async function probeInternetReachable(): Promise<boolean> {
  if (!readNavigatorOnline()) return false;

  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(REACHABILITY_URL, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
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
    const reachable = await probeInternetReachable();
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
