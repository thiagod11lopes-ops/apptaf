import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';

export type SyncStatus =
  | 'local'
  | 'synced'
  | 'updated'
  | 'deleted'
  | 'conflict'
  /** @deprecated use updated/local/deleted */
  | 'pending'
  /** falha de envio na fila */
  | 'failed';
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed';
export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'SYNCING';
export type CollectionName = 'cadastros' | 'sessoes' | 'aplicadores';

export interface SyncableMeta {
  createdAt: number;
  updatedAt: number;
  version: number;
  deviceId: string;
  userId: string | null;
  syncStatus: SyncStatus;
  syncVersion?: number;
  deleted: boolean;
  deletedAt?: number;
  deletedBy?: string;
  lastModifiedBy: string;
  lastSync?: number;
  updatedBy?: string;
}

export interface CadastroRecord extends CadastroItemPersist, SyncableMeta {
  ownerUid: string;
}

export interface SessaoRecord extends SessaoAplicacaoTaf, SyncableMeta {
  ownerUid: string;
}

export interface AplicadorRecord extends AplicadorItemPersist, SyncableMeta {
  ownerUid: string;
}

export interface SyncQueueEntry {
  operationId: string;
  operationType: OperationType;
  collection: CollectionName;
  documentId: string;
  payload: string;
  timestamp: number;
  retries: number;
  status: QueueStatus;
  ownerUid: string;
  error?: string;
}

export interface ChangeLogEntry {
  id?: number;
  documentId: string;
  collection: CollectionName;
  action: OperationType;
  deviceId: string;
  userId: string | null;
  previousVersion: number;
  newVersion: number;
  timestamp: number;
  resolution?: string;
  details?: string;
}

export interface SyncLogEntry {
  id?: number;
  level: 'info' | 'warn' | 'error';
  category: 'sync' | 'connectivity' | 'queue' | 'audit';
  message: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface SyncAuditEntry {
  id?: number;
  ownerUid: string;
  userId: string | null;
  userEmail?: string | null;
  deviceId: string;
  appVersion?: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  uploads: number;
  downloads: number;
  ignored: number;
  failures: number;
  errors: string[];
  errorMessage?: string | null;
  localTimeMs?: number;
  serverTimeMs?: number | null;
  clockDriftMs?: number;
  clockDriftWarning?: boolean;
  backupId?: number | null;
  result: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED';
  strategy: 'last_write_wins';
  collectionCounts?: {
    cadastros: { local: number; remote: number };
    sessoes: { local: number; remote: number };
    aplicadores: { local: number; remote: number };
  };
  deletions?: import('./tombstone').DeletionAuditEntry[];
}

export interface LocalBackupSnapshot {
  id?: number;
  ownerUid: string;
  createdAt: number;
  cadastros: CadastroRecord[];
  sessoes: SessaoRecord[];
  aplicadores: AplicadorRecord[];
}

/** @deprecated LWW substitui resolução manual de conflitos */
export type ConflictResolution = {
  winner: 'local' | 'remote' | 'equal';
  record: CadastroRecord | SessaoRecord | AplicadorRecord;
  action: 'upload' | 'download' | 'skip';
  reason: string;
};
