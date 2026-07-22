import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import {
  buildBackupOdsBytes,
  colunasComConteudo,
  montarLinhasPlanilhaTaf,
} from '../../src/utils/backupTafOds';
import { buildZipStoreOnly, crc32, utf8Bytes } from '../../src/utils/zipStoreOnly';

function cadastro(partial: Partial<CadastroItemPersist> & Pick<CadastroItemPersist, 'id' | 'nip' | 'nome'>): CadastroItemPersist {
  return {
    dataNascimento: '01/01/1990',
    categoria: 'Praças',
    praca: 'MN',
    ...partial,
  };
}

describe('zipStoreOnly', () => {
  it('gera zip STORE legível com mimetype primeiro', () => {
    const zip = buildZipStoreOnly([
      { name: 'mimetype', data: utf8Bytes('application/vnd.oasis.opendocument.spreadsheet') },
      { name: 'hello.txt', data: utf8Bytes('ola') },
    ]);
    expect(zip[0]).toBe(0x50); // P
    expect(zip[1]).toBe(0x4b); // K
    const asText = new TextDecoder().decode(zip);
    expect(asText.indexOf('mimetype')).toBeLessThan(asText.indexOf('hello.txt'));
    expect(crc32(utf8Bytes('ola'))).toBeGreaterThan(0);
  });
});

describe('backupTafOds', () => {
  it('omite colunas sem conteúdo (ex.: flexão)', () => {
    const linhas = montarLinhasPlanilhaTaf([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Fulano',
        tempoCorrida: '12:30',
        notaCorrida: '80',
        resultadoPermanencia: 'aprovado',
      }),
    ]);
    const cols = colunasComConteudo(linhas);
    expect(cols).toContain('corridaTempo');
    expect(cols).toContain('corridaPontos');
    expect(cols).toContain('permanencia');
    expect(cols).toContain('geral');
    expect(cols).not.toContain('flexaoBarra');
    expect(cols).not.toContain('flexaoSolo');
    expect(cols).not.toContain('natacaoTempo');
  });

  it('inclui flexão só quando houver dado', () => {
    const linhas = montarLinhasPlanilhaTaf([
      cadastro({
        id: '2',
        nip: '87654321',
        nome: 'Beltrano',
        repsFlexaoBarra: 8,
        notaFlexaoBarra: '70',
      }),
    ]);
    const cols = colunasComConteudo(linhas);
    expect(cols).toContain('flexaoBarra');
    expect(cols).toContain('flexaoBarraPontos');
    expect(cols).not.toContain('corridaTempo');
  });

  it('marca REPROVADO no geral se falhou em alguma prova', () => {
    const linhas = montarLinhasPlanilhaTaf([
      cadastro({
        id: '3',
        nip: '11112222',
        nome: 'Ciclano',
        notaCorrida: '90',
        tempoCorrida: '11:00',
        resultadoPermanencia: 'reprovado',
      }),
    ]);
    expect(linhas[0]?.geral).toBe('REPROVADO');
  });

  it('gera bytes ODS com assinatura ZIP e content.xml', () => {
    const bytes = buildBackupOdsBytes([
      cadastro({ id: '4', nip: '33334444', nome: 'Delta', tempoNatacao: '08:00', notaNatacao: '100' }),
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('mimetype');
    expect(text).toContain('content.xml');
    expect(text).toContain('NATAÇÃO TEMPO');
    expect(text).toContain('08:00');
  });
});
