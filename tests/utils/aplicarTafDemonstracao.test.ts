import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import {
  filtrarCadastrosDemonstracao,
  isCadastroDemonstracaoCfn,
  nipFeedbackOkFromCadastro,
} from '../../src/utils/aplicarTafDemonstracao';
import { DEMO_TOTAL_CFN, gerarDadosDemonstracaoTaf } from '../../src/utils/gerarDadosDemonstracaoTaf';

describe('aplicarTafDemonstracao', () => {
  const { cadastros } = gerarDadosDemonstracaoTaf();

  it('separa cadastros Armada e CFN no modo demonstração', () => {
    const armada = filtrarCadastrosDemonstracao(cadastros, false);
    const cfn = filtrarCadastrosDemonstracao(cadastros, true);

    expect(armada).toHaveLength(50 - DEMO_TOTAL_CFN);
    expect(cfn).toHaveLength(DEMO_TOTAL_CFN);
    expect(armada.every((c) => !isCadastroDemonstracaoCfn(c))).toBe(true);
    expect(cfn.every((c) => isCadastroDemonstracaoCfn(c))).toBe(true);
  });

  it('monta feedback ok para linha de NIP', () => {
    const c: CadastroItemPersist = cadastros[0]!;
    const fb = nipFeedbackOkFromCadastro(c);
    expect(fb.tipo).toBe('ok');
    expect(fb.nomeMilitar).toContain('Demo');
    expect(fb.dataNascimento).toBeTruthy();
  });
});
