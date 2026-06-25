import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY = 'taf:deviceId';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored?.trim()) {
      cachedDeviceId = stored.trim();
      return cachedDeviceId;
    }
  } catch {
    // continua
  }

  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const ls = localStorage.getItem(STORAGE_KEY);
    if (ls?.trim()) {
      cachedDeviceId = ls.trim();
      await AsyncStorage.setItem(STORAGE_KEY, cachedDeviceId).catch(() => undefined);
      return cachedDeviceId;
    }
  }

  cachedDeviceId = randomId();
  await AsyncStorage.setItem(STORAGE_KEY, cachedDeviceId).catch(() => undefined);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, cachedDeviceId);
  }
  return cachedDeviceId;
}

export function peekDeviceId(): string | null {
  return cachedDeviceId;
}
