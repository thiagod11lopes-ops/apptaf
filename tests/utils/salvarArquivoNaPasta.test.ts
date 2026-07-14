import { describe, expect, it } from 'vitest';
import {
  mensagemSucessoSalvarNaPasta,
  sanitizarNomeArquivo,
} from '../../src/utils/salvarArquivoNaPasta';

describe('salvarArquivoNaPasta', () => {
  it('sanitizarNomeArquivo remove caracteres inválidos e garante extensão', () => {
    expect(sanitizarNomeArquivo('Resultados do dia — 14/07/2026', '.pdf')).toBe(
      'Resultados do dia — 14_07_2026.pdf',
    );
    expect(sanitizarNomeArquivo('Backup apptaf 03-07-2026.csv', '.csv')).toBe(
      'Backup apptaf 03-07-2026.csv',
    );
    expect(sanitizarNomeArquivo('a/b\\c:d?e*f|"g<.h>', '.txt')).toBe('a_b_c_d_e_f__g_.h_.txt');
  });

  it('mensagemSucessoSalvarNaPasta distingue modos', () => {
    expect(mensagemSucessoSalvarNaPasta({ ok: true, modo: 'pasta' })).toContain('pasta escolhida');
    expect(mensagemSucessoSalvarNaPasta({ ok: true, modo: 'download' })).toContain('Download');
    expect(mensagemSucessoSalvarNaPasta({ ok: true, modo: 'compartilhar' })).toContain('Arquivos');
  });
});
