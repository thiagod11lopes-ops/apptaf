import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import { buildBackupPlanilhaPdfBytes } from '../../src/utils/backupTafPlanilhaPdf';
import { buildBackupPlanilhaPdfFilename } from '../../src/utils/backupNaming';

function cadastro(
  partial: Partial<CadastroItemPersist> & Pick<CadastroItemPersist, 'id' | 'nip' | 'nome'>,
): CadastroItemPersist {
  return {
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    praca: 'MN',
    ...partial,
  };
}

describe('backupTafPlanilhaPdf', () => {
  it('gera PDF com assinatura %PDF e dados Armada/FN', async () => {
    const bytes = await buildBackupPlanilhaPdfBytes([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Fulano',
        tempoCorrida: '12:30',
        notaCorrida: '80',
        tempoNatacao: '01:10',
        notaNatacao: '90',
        resultadoPermanencia: 'aprovado',
      }),
      cadastro({
        id: '2',
        nip: '87654321',
        nome: 'Beltrano FN',
        tempoCorrida: '14:00',
        notaCorrida: '70',
        repsFlexaoBarra: 8,
        notaFlexaoBarra: '80',
        repsAbdominalRemador: 40,
        notaAbdominalRemador: '85',
      }),
    ]);
    expect(bytes.byteLength).toBeGreaterThan(500);
    const head = String.fromCharCode(...bytes.slice(0, 5));
    expect(head).toBe('%PDF-');
  });

  it('nome do arquivo segue Planilha PDF (data).pdf', () => {
    expect(buildBackupPlanilhaPdfFilename(new Date('2026-07-27T15:00:00.000Z'))).toMatch(
      /^Planilha PDF \(\d{2}-\d{2}-\d{4}\)\.pdf$/,
    );
  });
});
