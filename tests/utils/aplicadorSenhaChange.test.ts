import { describe, expect, it } from 'vitest';
import { isMemberAplicadorSenhaChange } from '../../src/utils/aplicadorSyncPolicy';

const base = {
  id: 'a1',
  nip: '12.3456.78',
  nome: 'FULANO DE TAL',
  categoria: 'Praças' as const,
};

describe('isMemberAplicadorSenhaChange', () => {
  it('aceita alteração apenas de senhaHash com identidade preservada', () => {
    const local = { ...base, senhaHash: 'novo' };
    const remote = { ...base, senhaHash: 'antigo' };
    expect(isMemberAplicadorSenhaChange(local, remote)).toBe(true);
  });

  it('rejeita quando o nome muda', () => {
    const local = { ...base, nome: 'OUTRO NOME', senhaHash: 'novo' };
    const remote = { ...base, senhaHash: 'antigo' };
    expect(isMemberAplicadorSenhaChange(local, remote)).toBe(false);
  });

  it('rejeita quando o NIP muda', () => {
    const local = { ...base, nip: '99.9999.99', senhaHash: 'novo' };
    const remote = { ...base, senhaHash: 'antigo' };
    expect(isMemberAplicadorSenhaChange(local, remote)).toBe(false);
  });

  it('rejeita quando a categoria muda', () => {
    const local = { ...base, categoria: 'Oficiais' as const, senhaHash: 'novo' };
    const remote = { ...base, senhaHash: 'antigo' };
    expect(isMemberAplicadorSenhaChange(local, remote)).toBe(false);
  });

  it('rejeita registros excluídos ou ausentes', () => {
    expect(isMemberAplicadorSenhaChange({ ...base, deleted: true }, base)).toBe(false);
    expect(isMemberAplicadorSenhaChange(base, { ...base, deleted: true })).toBe(false);
    expect(isMemberAplicadorSenhaChange(null, base)).toBe(false);
    expect(isMemberAplicadorSenhaChange(base, undefined)).toBe(false);
  });
});
