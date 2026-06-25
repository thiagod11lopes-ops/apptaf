import 'fake-indexeddb/auto';
import { vi } from 'vitest';

(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

vi.mock('expo-print', () => ({}));
vi.mock('expo-sharing', () => ({}));

(globalThis as typeof globalThis & { expo?: { EventEmitter?: new () => unknown } }).expo = {
  EventEmitter: class EventEmitter {},
};
