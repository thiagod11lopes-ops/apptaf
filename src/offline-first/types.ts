import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import type { AplicadorItemPersist } from '../services/aplicadoresIndexedDb';
import type { SessaoAplicacaoTaf } from '../services/resultadosAplicadosIndexedDb';

export type SyncStatus = 'pending' | 'synced' | 'conflict' | 'failed';
export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';
export type QueueStatus = 'pending' | 'processing' | 'done' | 'failed';
export type ConnectivityState = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'SYNCING';
export type CollectionName = 'cadastros' | 'sessoes';

export interface SyncableMeta {
  createdAt: number;
  updatedAt: number;
  version: number;
  deviceId: string;
  userId: string | null;
  syncStatus: SyncStatus;
  deleted: boolean;
  deletedAt?: number;
  deletedBy?: string;
  lastModifiedBy: string;
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
  category: 'sync' | 'conflict' | 'connectivity' | 'queue' | 'realtime';
  message: string;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export type ConflictResolution = {
  winner: 'local' | 'remote' | 'merged';
  record: CadastroRecord | SessaoRecord;
  hadConflict: boolean;
  reason: string;
};
