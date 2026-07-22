import { describe, expect, it } from 'vitest';
import type { CadastroItemPersist } from '../../src/services/cadastrosIndexedDb';
import {
  buildBackupOdsBytes,
  buildPlanilhaTafContentXml,
  buildPlanilhaTafPackage,
  calcularBalancoPlanilhaTaf,
  estiloPontos,
  montarLinhasArmada,
  primeiraRubricaSvgDoCadastro,
  situacaoGeralPlanilha,
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

const RUBRICA_A = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M1 20 L99 20" stroke="#111" fill="none"/></svg>',
)}`;
const RUBRICA_B = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><path d="M1 10 L99 30" stroke="#111" fill="none"/></svg>',
)}`;

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
    expect(xml).toContain('ceTestePendente');
  });

  it('insere balanço de quantidade abaixo do título', () => {
    const lista = [
      cadastro({ id: 'a', nip: '1', nome: 'Sem' }),
      cadastro({
        id: 'b',
        nip: '2',
        nome: 'Parcial',
        tempoCorrida: '12:00',
        notaCorrida: '80',
      }),
      cadastro({
        id: 'c',
        nip: '3',
        nome: 'Completo',
        tempoCorrida: '12:00',
        notaCorrida: '80',
        tempoNatacao: '01:00',
        notaNatacao: '90',
        resultadoPermanencia: 'aprovado',
      }),
    ];
    const balanco = calcularBalancoPlanilhaTaf(lista);
    expect(balanco).toEqual({
      cadastrados: 3,
      parcial: 1,
      completo: 1,
    });

    const xml = buildPlanilhaTafContentXml(lista);
    expect(xml).toContain('BALANÇO DE QUANTIDADE');
    expect(xml).toContain('Militares cadastrados');
    expect(xml).toContain('Parcial');
    expect(xml).toContain('Completo');
    expect(xml).not.toContain('Testes Pendentes');
    expect(xml).not.toContain('Realizaram todos os testes');
    expect(xml).toContain('ceBalancoTitulo');
    // título do balanço em 1 célula (formato 123.ods), sem span 11
    expect(xml).toContain(
      'table:style-name="ceBalancoTitulo" office:value-type="string" calcext:value-type="string"><text:p>BALANÇO DE QUANTIDADE</text:p>',
    );
    expect(xml).not.toMatch(/ceBalancoTitulo[^>]*number-columns-spanned="11"/);
    // duas abas → título do balanço duas vezes
    expect(xml.split('BALANÇO DE QUANTIDADE').length - 1).toBe(2);
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
    expect(xml).toContain('Com Teste');
    expect(xml).toContain('TESTE PENDENTE');
  });

  it('usa TESTE PENDENTE até concluir os três testes', () => {
    expect(
      situacaoGeralPlanilha(
        cadastro({
          id: '1',
          nip: '1',
          nome: 'A',
          tempoCorrida: '12:00',
          notaCorrida: '80',
          resultadoPermanencia: 'aprovado',
        }),
      ),
    ).toBe('TESTE PENDENTE');

    expect(
      situacaoGeralPlanilha(
        cadastro({
          id: '2',
          nip: '2',
          nome: 'B',
          tempoCorrida: '12:00',
          notaCorrida: '80',
          tempoNatacao: '01:00',
          notaNatacao: '90',
          resultadoPermanencia: 'aprovado',
        }),
      ),
    ).toBe('APROVADO');

    expect(
      situacaoGeralPlanilha(
        cadastro({
          id: '3',
          nip: '3',
          nome: 'C',
          tempoCorrida: '12:00',
          notaCorrida: 'REPROVADO',
          tempoNatacao: '01:00',
          notaNatacao: '90',
          resultadoPermanencia: 'aprovado',
        }),
      ),
    ).toBe('REPROVADO');
  });

  it('colore pontos abaixo de 50 em vermelho e >= 50 em verde', () => {
    expect(estiloPontos('49')).toBe('cePontosVermelho');
    expect(estiloPontos('50')).toBe('cePontosVerde');
    expect(estiloPontos('REPROVADO')).toBe('cePontosVermelho');
  });

  it('aplica estilos de cor no XML gerado', () => {
    const xmlCompleto = buildPlanilhaTafContentXml([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Fulano',
        tempoCorrida: '12:30',
        notaCorrida: '40',
        tempoNatacao: '01:10',
        notaNatacao: '80',
        resultadoPermanencia: 'reprovado',
      }),
    ]);
    expect(xmlCompleto).toContain('cePontosVermelho');
    expect(xmlCompleto).toContain('cePontosVerde');
    expect(xmlCompleto).toContain('cePermReprovado');
    expect(xmlCompleto).toContain('ceGeralReprovado');
    expect(xmlCompleto).toContain('>REPROVADO<');

    const xmlPendente = buildPlanilhaTafContentXml([
      cadastro({
        id: '2',
        nip: '22223333',
        nome: 'Parcial',
        tempoCorrida: '12:00',
        notaCorrida: '70',
      }),
    ]);
    expect(xmlPendente).toContain('TESTE PENDENTE');
    expect(xmlPendente).toContain('ceTestePendente');
  });

  it('escolhe a rúbrica do primeiro teste pela data', () => {
    const svg = primeiraRubricaSvgDoCadastro(
      cadastro({
        id: '1',
        nip: '1',
        nome: 'X',
        dataTafNatacao: '10/01/2026',
        rubricaNatacaoSvg: RUBRICA_B,
        dataTafCorrida: '05/01/2026',
        rubricaCorridaSvg: RUBRICA_A,
        tempoCorrida: '12:00',
        notaCorrida: '80',
        tempoNatacao: '01:00',
        notaNatacao: '90',
      }),
    );
    expect(svg).toBe(RUBRICA_A);
  });

  it('embute a rúbrica SVG no pacote ODS', () => {
    const pack = buildPlanilhaTafPackage([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Com Rubrica',
        tempoCorrida: '12:00',
        notaCorrida: '80',
        dataTafCorrida: '01/02/2026',
        rubricaCorridaSvg: RUBRICA_A,
      }),
    ]);
    expect(pack.pictures.length).toBeGreaterThan(0);
    expect(pack.contentXml).toContain('Pictures/rubrica_a_0.svg');
    expect(pack.contentXml).toContain('draw:image');
    expect(pack.contentXml).toContain('style:horizontal-pos="center"');
    expect(pack.contentXml).toContain('ceRubrica');

    const bytes = buildBackupOdsBytes([
      cadastro({
        id: '1',
        nip: '12345678',
        nome: 'Com Rubrica',
        tempoCorrida: '12:00',
        notaCorrida: '80',
        dataTafCorrida: '01/02/2026',
        rubricaCorridaSvg: RUBRICA_A,
      }),
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('Pictures/rubrica_a_0.svg');
    expect(text).toContain('<svg');
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
    expect(xml).toContain('cePontosVerde');
  });

  it('montarLinhasArmada marca pendente sem rúbrica texto', () => {
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
    expect(linhas[0]?.geral).toBe('TESTE PENDENTE');
  });
});
