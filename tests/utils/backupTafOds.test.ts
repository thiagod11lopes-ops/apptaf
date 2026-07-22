import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import {
  buildBackupOdsBytes,
  buildPlanilhaTafContentXml,
  montarLinhasArmada,
} from '../../src/utils/backupTafOds';
import { buildZipStoreOnly, crc32, utf8Bytes } from '../../src/utils/zipStoreOnly';

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

describe('zipStoreOnly', () => {
  it('gera zip STORE legível com mimetype primeiro', () => {
    const zip = buildZipStoreOnly([
      { name: 'mimetype', data: utf8Bytes('application/vnd.oasis.opendocument.spreadsheet') },
      { name: 'hello.txt', data: utf8Bytes('ola') },
    ]);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    const asText = new TextDecoder().decode(zip);
    expect(asText.indexOf('mimetype')).toBeLessThan(asText.indexOf('hello.txt'));
    expect(crc32(utf8Bytes('ola'))).toBeGreaterThan(0);
  });
});

describe('backupTafOds (modelo HNMD)', () => {
  it('preserva cabeçalhos e abas do modelo anexado', () => {
    const xml = buildPlanilhaTafContentXml([]);
    expect(xml).toContain('table:name="modelo PESSOAL DA GOLA"');
    expect(xml).toContain('table:name="FN"');
    expect(xml).toContain('<text:p>HOSPITAL NAVAL MARCÍLIO DIAS</text:p>');
    expect(xml).toContain('<text:p>CORRIDA</text:p>');
    expect(xml).toContain('<text:p>TEMPO</text:p>');
    expect(xml).toContain('<text:p>NATAÇÃO</text:p>');
    expect(xml).toContain('<text:p>PERMANÊNCIA</text:p>');
    expect(xml).toContain('<text:p>APROVADO/REPROVADO</text:p>');
    expect(xml).toContain('<text:p>BARRA</text:p>');
    expect(xml).toContain('<text:p>SOLO</text:p>');
    expect(xml).toContain('<text:p>FLEXÃO</text:p>');
    expect(xml).toContain('<text:p>NOME DO APLICADOR DO TAF</text:p>');
  });

  it('preenche linha Armada com dados do cadastro', () => {
    const xml = buildPlanilhaTafContentXml([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Fulano da Silva',
        tempoCorrida: '12:30',
        notaCorrida: '80',
        resultadoPermanencia: 'aprovado',
      }),
    ]);
    expect(xml).toContain('Fulano da Silva');
    expect(xml).toContain('12345678');
    expect(xml).toContain('12:30');
    expect(xml).toContain('>80<');
    expect(xml).toContain('APROVADO');
  });

  it('não inclui militar sem nenhum teste', () => {
    const xml = buildPlanilhaTafContentXml([
      cadastro({ id: 'sem', nip: '99998888', nome: 'Sem Teste Algum' }),
      cadastro({
        id: 'com',
        nip: '11112222',
        nome: 'Com Teste',
        tempoCorrida: '11:00',
        notaCorrida: '90',
      }),
    ]);
    expect(xml).not.toContain('Sem Teste Algum');
    expect(xml).not.toContain('99998888');
    expect(xml).toContain('Com Teste');
    expect(xml).toContain('11112222');
  });

  it('preenche flexão na aba FN', () => {
    const xml = buildPlanilhaTafContentXml([
      cadastro({
        id: '2',
        nip: '87654321',
        nome: 'Beltrano',
        repsFlexaoBarra: 8,
        notaFlexaoBarra: '70',
        repsFlexaoSolo: 30,
      }),
    ]);
    expect(xml).toContain('Beltrano');
    expect(xml).toContain('>8<');
    expect(xml).toContain('>30<');
    expect(xml).toContain('>70<');
  });

  it('marca REPROVADO no geral se falhou em alguma prova', () => {
    const linhas = montarLinhasArmada([
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

  it('gera bytes ODS com styles do modelo e content preenchido', () => {
    const bytes = buildBackupOdsBytes([
      cadastro({ id: '4', nip: '33334444', nome: 'Delta', tempoNatacao: '08:00', notaNatacao: '100' }),
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('mimetype');
    expect(text).toContain('content.xml');
    expect(text).toContain('styles.xml');
    expect(text).toContain('Delta');
    expect(text).toContain('08:00');
    expect(text).toContain('HOSPITAL NAVAL');
  });
});
