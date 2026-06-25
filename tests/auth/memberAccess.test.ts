import { describe, expect, it } from 'vitest';
import { resolveMemberAccess } from '../../src/services/firebase/authorizedEmailsFirestore';

describe('resolveMemberAccess — lógica chefe/autorizado', () => {
  it('usuário sem e-mail usa próprio uid como owner', async () => {
    const r = await resolveMemberAccess('uid-1', null);
    expect(r).toEqual({ dataOwnerUid: 'uid-1', isAuthorizedMember: false });
  });

  it('e-mail vazio usa próprio uid', async () => {
    const r = await resolveMemberAccess('uid-1', '   ');
    expect(r.dataOwnerUid).toBe('uid-1');
    expect(r.isAuthorizedMember).toBe(false);
  });
});
