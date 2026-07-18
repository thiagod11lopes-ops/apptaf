import { afterEach, describe, expect, it } from 'vitest';
import {
  E2E_ENCRYPT_REQUIRED_MESSAGE,
  cloudRecordNeedsE2eUpgrade,
  decryptJson,
  encryptJson,
  getActiveTeamKey,
  isCloudDataEncrypted,
  isE2eKeyActive,
  maybeDecryptFromCloud,
  maybeEncryptForCloud,
  setActiveTeamKey,
  subscribeActiveTeamKey,
} from '../../src/services/supabase/e2eCrypto';

async function makeTeamKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

afterEach(() => {
  setActiveTeamKey(null);
});

describe('e2eCrypto — etapa 3 (cifrar / decifrar / bloqueio)', () => {
  it('cifra e decifra NIP e nome sem vazar no ciphertext', async () => {
    const key = await makeTeamKey();
    const plain = { id: 'cad-1', nome: 'Fulano da Silva', nip: '12.3456.78' };
    const cipher = await encryptJson(key, plain);

    expect(cipher.v).toBe(1);
    expect(cipher.alg).toBe('AES-GCM');
    expect(cipher.iv).toBeTruthy();
    expect(cipher.ct).toBeTruthy();
    expect(JSON.stringify(cipher)).not.toContain('Fulano');
    expect(JSON.stringify(cipher)).not.toContain('12.3456.78');

    const back = await decryptJson(key, cipher);
    expect(back.nome).toBe('Fulano da Silva');
    expect(back.nip).toBe('12.3456.78');
  });

  it('maybeEncryptForCloud bloqueia sem chave ativa (nunca sobe plaintext)', async () => {
    expect(isE2eKeyActive()).toBe(false);
    await expect(maybeEncryptForCloud({ nome: 'X', nip: '1' })).rejects.toThrow(
      E2E_ENCRYPT_REQUIRED_MESSAGE,
    );
  });

  it('maybeEncryptForCloud + maybeDecryptFromCloud com chave ativa', async () => {
    setActiveTeamKey(await makeTeamKey());
    const envelope = await maybeEncryptForCloud({ nome: 'Maria', nip: '98.7654.32' });
    expect(isCloudDataEncrypted(envelope)).toBe(true);
    expect(JSON.stringify(envelope)).not.toContain('Maria');

    const plain = await maybeDecryptFromCloud(envelope);
    expect(plain.nome).toBe('Maria');
    expect(plain.nip).toBe('98.7654.32');
  });

  it('maybeDecryptFromCloud devolve plaintext legado sem __e2e', async () => {
    const legacy = { nome: 'Legado', nip: '11.1111.11' };
    const out = await maybeDecryptFromCloud(legacy);
    expect(out).toEqual(legacy);
  });

  it('cloudRecordNeedsE2eUpgrade só com chave ativa e dado sem envelope', async () => {
    expect(cloudRecordNeedsE2eUpgrade({ nome: 'A' })).toBe(false);
    setActiveTeamKey(await makeTeamKey());
    expect(cloudRecordNeedsE2eUpgrade({ nome: 'A' })).toBe(true);
    const enc = await maybeEncryptForCloud({ nome: 'A' });
    expect(cloudRecordNeedsE2eUpgrade(enc)).toBe(false);
  });

  it('chave errada não decifra o payload', async () => {
    const keyA = await makeTeamKey();
    const keyB = await makeTeamKey();
    const cipher = await encryptJson(keyA, { nome: 'Segredo', nip: '00.0000.00' });
    await expect(decryptJson(keyB, cipher)).rejects.toThrow();
  });

  it('subscribeActiveTeamKey notifica ligar/desligar', async () => {
    const seen: boolean[] = [];
    const unsub = subscribeActiveTeamKey((active) => {
      seen.push(active);
    });
    expect(seen).toEqual([false]);
    setActiveTeamKey(await makeTeamKey());
    expect(getActiveTeamKey()).toBeTruthy();
    expect(seen.at(-1)).toBe(true);
    setActiveTeamKey(null);
    expect(seen.at(-1)).toBe(false);
    unsub();
  });
});
