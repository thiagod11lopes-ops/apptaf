import { describe, expect, it } from 'vitest';
import {
  aplicadorBusinessContentEqual,
  mergeAplicadorAfterRemoteDownload,
  stripSenhaFromAplicador,
  toAplicadorFirestorePayload,
  toAplicadorMemberView,
} from '../../src/utils/aplicadorSyncPolicy';
import type { AplicadorItemPersist } from '../../src/services/aplicadoresIndexedDb';

const base: AplicadorItemPersist = {
  id: 'a1',
  nip: '123',
  nome: 'Silva',
  categoria: 'Oficiais',
  sexo: 'M',
  oficial: 'Cap',
  senha: '1234',
  senhaHash: 'hash',
  updatedAt: 100,
};

describe('aplicadorSyncPolicy', () => {
  it('remove senha em texto do payload Firestore', () => {
    const payload = toAplicadorFirestorePayload(base);
    expect(payload.senha).toBeUndefined();
    expect(payload.senhaHash).toBe('hash');
    expect(payload.nip).toBe('123');
  });

  it('membro recebe subconjunto sem senha em texto', () => {
    const view = toAplicadorMemberView(base);
    expect(view).toEqual({
      id: 'a1',
      nip: '123',
      nome: 'Silva',
      categoria: 'Oficiais',
      oficial: 'Cap',
      praca: undefined,
      senhaHash: 'hash',
      updatedAt: 100,
    });
    expect(stripSenhaFromAplicador(base).senha).toBeUndefined();
  });

  it('chefe preserva senha local após download remoto', () => {
    const merged = mergeAplicadorAfterRemoteDownload(
      { ...base, senha: 'remota', nome: 'Silva Atualizado' },
      { ...base, ownerUid: 'boss', syncStatus: 'synced' } as never,
      false,
    );
    expect(merged.nome).toBe('Silva Atualizado');
    expect(merged.senha).toBe('1234');
    expect(merged.senhaHash).toBe('hash');
  });

  it('membro não recebe senha após download remoto', () => {
    const merged = mergeAplicadorAfterRemoteDownload(
      { ...base, senha: 'remota' },
      undefined,
      true,
    );
    expect(merged.senha).toBeUndefined();
    expect(merged.nip).toBe('123');
    expect(merged.senhaHash).toBe('hash');
  });

  it('compara conteúdo de negócio ignorando senha em texto', () => {
    expect(aplicadorBusinessContentEqual(base, { ...base, senha: 'outra' })).toBe(true);
    expect(aplicadorBusinessContentEqual(base, { ...base, senhaHash: 'outro' })).toBe(false);
  });
});
