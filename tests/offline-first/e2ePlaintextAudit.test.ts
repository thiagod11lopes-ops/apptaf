import { describe, expect, it } from 'vitest';
import {
  formatPlaintextAuditSummary,
  type PlaintextAuditSummary,
} from '../../src/services/supabase/e2ePlaintextAudit';
import { isCloudDataEncrypted, cloudRecordNeedsE2eUpgrade } from '../../src/services/supabase/e2eCrypto';

describe('e2ePlaintextAudit (etapa 2)', () => {
  it('formatPlaintextAuditSummary — vazio', () => {
    expect(formatPlaintextAuditSummary({ byTable: {}, total: 0 })).toMatch(/Nenhum registro/);
  });

  it('formatPlaintextAuditSummary — com tabelas', () => {
    const summary: PlaintextAuditSummary = {
      byTable: { cadastros: 2, sessoes: 0, aplicador_senhas: 1 },
      total: 3,
    };
    const text = formatPlaintextAuditSummary(summary);
    expect(text).toContain('3 registro');
    expect(text).toContain('cadastros:2');
    expect(text).toContain('aplicador_senhas:1');
    expect(text).not.toContain('sessoes:');
  });

  it('isCloudDataEncrypted distingue plaintext de envelope __e2e', () => {
    expect(isCloudDataEncrypted({ nome: 'Fulano', nip: '123' })).toBe(false);
    expect(
      isCloudDataEncrypted({
        __e2e: { v: 1, alg: 'AES-GCM', iv: 'YWJj', ct: 'ZGVm' },
      }),
    ).toBe(true);
  });

  it('cloudRecordNeedsE2eUpgrade sem chave ativa é false', () => {
    expect(cloudRecordNeedsE2eUpgrade({ nome: 'X' })).toBe(false);
  });
});
