import type { SyncRecord } from './lastWriteWins';

const NON_BUSINESS_FIELDS = new Set([
  'ownerUid',
  'createdAt',
  'updatedAt',
  'version',
  'syncVersion',
  'deviceId',
  'userId',
  'updatedBy',
  'lastModifiedBy',
  'lastSync',
  'syncStatus',
  'deletedAt',
  'deletedBy',
]);

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (NON_BUSINESS_FIELDS.has(key)) continue;
    const item = source[key];
    if (item === undefined) continue;
    result[key] = canonicalize(item);
  }
  return result;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** SHA-256; somente o hash é persistido, nunca o conteúdo usado como entrada. */
export async function sha256Text(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return `sha256:${bytesToHex(new Uint8Array(digest))}`;
}

/** Fingerprint canônico do conteúdo do registro sem metadados de sincronização. */
export async function hashConflictContent(record: SyncRecord): Promise<string> {
  return sha256Text(JSON.stringify(canonicalize(record)));
}
