import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const metaStore = new Map<
  string,
  { owner_uid: string; salt_b64: string; wrapped_key_b64: string; key_version: number }
>();

vi.mock('../../src/services/supabase/teamE2eCloud', () => ({
  fetchTeamE2eMeta: vi.fn(async (ownerUid: string) => metaStore.get(ownerUid) ?? null),
  upsertTeamE2eMeta: vi.fn(
    async (ownerUid: string, saltB64: string, wrappedKeyB64: string, keyVersion = 1) => {
      metaStore.set(ownerUid, {
        owner_uid: ownerUid,
        salt_b64: saltB64,
        wrapped_key_b64: wrappedKeyB64,
        key_version: keyVersion,
      });
    },
  ),
}));

import {
  activateE2eFromLoginPassword,
  clearE2eSession,
  ensureE2eKeyForCloudSync,
  ensureTeamKeyUnlocked,
  restoreE2eFromSessionStorage,
  rewrapTeamKeyWithNewPassword,
} from '../../src/services/supabase/teamE2eSession';
import {
  getActiveTeamKey,
  isE2eKeyActive,
  maybeDecryptFromCloud,
  maybeEncryptForCloud,
  setActiveTeamKey,
} from '../../src/services/supabase/e2eCrypto';

const OWNER = 'owner-e2e-session-1';
const PASS_OLD = 'senha-antiga-segura';
const PASS_NEW = 'senha-nova-segura';

function installSessionStorage(): void {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  metaStore.clear();
  clearE2eSession();
  installSessionStorage();
});

afterEach(() => {
  clearE2eSession();
  metaStore.clear();
});

describe('teamE2eSession — etapa 3 (ativação / restore / reembrulho)', () => {
  it('primeira ativação cria meta e deixa chave ativa', async () => {
    await activateE2eFromLoginPassword(OWNER, PASS_OLD);
    expect(isE2eKeyActive()).toBe(true);
    expect(metaStore.get(OWNER)?.wrapped_key_b64).toBeTruthy();
    expect(metaStore.get(OWNER)?.key_version).toBe(1);
  });

  it('cifra NIP/nome com chave da sessão e recupera após restore', async () => {
    await activateE2eFromLoginPassword(OWNER, PASS_OLD);
    const envelope = await maybeEncryptForCloud({
      nome: 'Cabo Teste',
      nip: '22.2222.22',
    });
    expect(JSON.stringify(envelope)).not.toContain('Cabo Teste');

    setActiveTeamKey(null);
    expect(isE2eKeyActive()).toBe(false);

    const restored = await restoreE2eFromSessionStorage(OWNER);
    expect(restored).toBe(true);
    expect(isE2eKeyActive()).toBe(true);

    const plain = await maybeDecryptFromCloud(envelope);
    expect(plain.nome).toBe('Cabo Teste');
    expect(plain.nip).toBe('22.2222.22');
  });

  it('reembrulho: senha nova desbloqueia; senha antiga não', async () => {
    await activateE2eFromLoginPassword(OWNER, PASS_OLD);
    const envelope = await maybeEncryptForCloud({ nome: 'Persistente', nip: '33.3333.33' });

    await rewrapTeamKeyWithNewPassword(OWNER, PASS_NEW);
    expect(metaStore.get(OWNER)?.key_version).toBe(2);

    // Ainda com DEK em memória — dados antigos legíveis
    const stillReadable = await maybeDecryptFromCloud(envelope);
    expect(stillReadable.nome).toBe('Persistente');

    clearE2eSession();
    await expect(activateE2eFromLoginPassword(OWNER, PASS_OLD)).rejects.toThrow();

    await activateE2eFromLoginPassword(OWNER, PASS_NEW);
    const after = await maybeDecryptFromCloud(envelope);
    expect(after.nome).toBe('Persistente');
    expect(after.nip).toBe('33.3333.33');
  });

  it('ensureTeamKeyUnlocked falha sem sessão e restore', async () => {
    await expect(ensureTeamKeyUnlocked(OWNER)).rejects.toThrow(/Trocar senha|escudo verde/i);
  });

  it('ensureE2eKeyForCloudSync passa com chave ativa', async () => {
    await activateE2eFromLoginPassword(OWNER, PASS_OLD);
    await expect(ensureE2eKeyForCloudSync(OWNER)).resolves.toBeUndefined();
    expect(getActiveTeamKey()).toBeTruthy();
  });

  it('ensureE2eKeyForCloudSync exige login quando meta existe sem chave', async () => {
    await activateE2eFromLoginPassword(OWNER, PASS_OLD);
    clearE2eSession();
    // remove sessionStorage para simular outro aparelho
    sessionStorage.clear();
    await expect(ensureE2eKeyForCloudSync(OWNER)).rejects.toThrow(/não está ativa/i);
  });
});
