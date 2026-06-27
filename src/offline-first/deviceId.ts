import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { readAppMetaCache, writeAppMetaSync } from '../offline-first/db/appMeta';

const DEVICE_ID_META_KEY = 'device:id';

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  const fromMeta = readAppMetaCache(DEVICE_ID_META_KEY);
  if (fromMeta) {
    cachedDeviceId = fromMeta;
    return cachedDeviceId;
  }

  if (Platform.OS !== 'web') {
    try {
      const stored = await AsyncStorage.getItem(DEVICE_ID_META_KEY);
      if (stored?.trim()) {
        cachedDeviceId = stored.trim();
        writeAppMetaSync(DEVICE_ID_META_KEY, cachedDeviceId);
        return cachedDeviceId;
      }
    } catch {
      // continua
    }
  }

  cachedDeviceId = randomId();
  writeAppMetaSync(DEVICE_ID_META_KEY, cachedDeviceId);
  if (Platform.OS !== 'web') {
    await AsyncStorage.setItem(DEVICE_ID_META_KEY, cachedDeviceId).catch(() => undefined);
  }
  return cachedDeviceId;
}

export function peekDeviceId(): string | null {
  return cachedDeviceId;
}
