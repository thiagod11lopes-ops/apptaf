import type { ChangeLogEntry, SyncLogEntry } from '../types';
import { getTafDatabase } from '../db/tafDatabase';

const memoryLogs: SyncLogEntry[] = [];
const MAX_MEMORY_LOGS = 200;

class SyncLogger {
  async log(entry: Omit<SyncLogEntry, 'id' | 'timestamp'> & { timestamp?: number }): Promise<void> {
    const row: SyncLogEntry = {
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
    };

    memoryLogs.unshift(row);
    if (memoryLogs.length > MAX_MEMORY_LOGS) memoryLogs.pop();

    const db = getTafDatabase();
    if (db) {
      await db.syncLogs.add(row).catch(() => undefined);
    }

    if (typeof console !== 'undefined' && entry.level === 'error') {
      console.error(`[TAF ${entry.category}]`, entry.message, entry.meta ?? '');
    }
  }

  info(category: SyncLogEntry['category'], message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'info', category, message, meta });
  }

  warn(category: SyncLogEntry['category'], message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'warn', category, message, meta });
  }

  error(category: SyncLogEntry['category'], message: string, meta?: Record<string, unknown>): Promise<void> {
    return this.log({ level: 'error', category, message, meta });
  }

  async appendChangeLog(entry: Omit<ChangeLogEntry, 'id' | 'timestamp'> & { timestamp?: number }): Promise<void> {
    const row: ChangeLogEntry = { ...entry, timestamp: entry.timestamp ?? Date.now() };
    const db = getTafDatabase();
    if (db) await db.changeLog.add(row).catch(() => undefined);
  }

  async recentLogs(limit = 100): Promise<SyncLogEntry[]> {
    const db = getTafDatabase();
    if (db) {
      const rows = await db.syncLogs.orderBy('timestamp').reverse().limit(limit).toArray();
      if (rows.length > 0) return rows;
    }
    return memoryLogs.slice(0, limit);
  }

  async recentChanges(limit = 50): Promise<ChangeLogEntry[]> {
    const db = getTafDatabase();
    if (!db) return [];
    return db.changeLog.orderBy('timestamp').reverse().limit(limit).toArray();
  }
}

export const syncLogger = new SyncLogger();
