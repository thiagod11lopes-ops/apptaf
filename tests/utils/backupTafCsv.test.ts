import { describe, expect, it } from 'vitest';
import { buildBackupCsvContent } from '../../src/utils/backupTafCsv';
import type { SystemBackupPayload } from '../../src/utils/gatherSystemBackupData';

const emptyPayload = (): SystemBackupPayload => ({
  cadastros: [],
  sessoes: [],
  aplicadores: [],
  preCadastros: [],
  authorizedEmails: [],
  syncQueue: [],
  appMeta: [],
});

describe('buildBackupCsvContent', () => {
  it('gera backup v2 com todas as seções solicitadas', () => {
    const content = buildBackupCsvContent(emptyPayload());

    expect(content).toContain('# TAF_BACKUP_VERSION=2');
    expect(content).toContain('# SECTION_CADASTROS');
    expect(content).toContain('# SECTION_SESSOES');
    expect(content).toContain('# SECTION_APLICADORES');
    expect(content).toContain('# SECTION_PRE_CADASTROS');
    expect(content).toContain('# SECTION_EMAILS_AUTORIZADOS');
    expect(content).toContain('# SECTION_SYNC_QUEUE');
    expect(content).toContain('# SECTION_APP_META');
  });

  it('inclui campos de caminhada, CFN e assinatura do aplicador nos cabeçalhos', () => {
    const content = buildBackupCsvContent(emptyPayload());

    expect(content).toMatch(/tempoCaminhada/);
    expect(content).toMatch(/notaCaminhada/);
    expect(content).toMatch(/dataTafCaminhada/);
    expect(content).toMatch(/rubricaCaminhadaSvg/);
    expect(content).toMatch(/notaFlexaoBarra/);
    expect(content).toMatch(/notaAbdominalPrancha/);
    expect(content).toMatch(/sessao_aplicadorRubricaSvg/);
  });
});
