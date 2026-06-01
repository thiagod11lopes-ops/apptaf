import type { CadastroItemPersist } from '../services/cadastrosIndexedDb';
import { addCadastrosEmLote, getAllCadastros } from '../services/cadastrosIndexedDb';
import { extrairTextoDePdf } from './extractPdfText';
import { nipDigitos } from './nipFormat';
import {
  linhaRelacaoParaCadastro,
  linhasRelacaoParaCadastros,
  parseRelacaoCadastroPdfText,
} from './parseRelacaoCadastroPdf';

export type ResultadoImportacaoPlanilha = {
  totalNoArquivo: number;
  importados: number;
  ignoradosDuplicados: number;
  erros: string[];
};

export async function importarCadastrosDePdf(
  arrayBuffer: ArrayBuffer,
  opcoes?: { substituirDuplicados?: boolean },
): Promise<ResultadoImportacaoPlanilha> {
  const substituir = opcoes?.substituirDuplicados ?? false;
  const texto = (await extrairTextoDePdf(arrayBuffer)).trim();
  const linhas = parseRelacaoCadastroPdfText(texto);

  if (!texto || texto.length < 20) {
    return {
      totalNoArquivo: 0,
      importados: 0,
      ignoradosDuplicados: 0,
      erros: [
        'Não foi possível ler texto do PDF. O arquivo pode ser uma imagem digitalizada — use o PDF exportado diretamente do Excel/planilha.',
      ],
    };
  }

  if (linhas.length === 0) {
    return {
      totalNoArquivo: 0,
      importados: 0,
      ignoradosDuplicados: 0,
      erros: [
        'Nenhum militar encontrado no arquivo. Confira se o PDF contém as colunas Posto/Graduação, NIP e Militar (como na relação SISTAF).',
      ],
    };
  }

  const existentes = await getAllCadastros();
  const porNip = new Map<string, CadastroItemPersist>();
  for (const c of existentes) {
    const d = nipDigitos(c.nip);
    if (d) porNip.set(d, c);
  }

  const paraSalvar: CadastroItemPersist[] = [];
  let ignoradosDuplicados = 0;

  for (const linha of linhas) {
    const digits = nipDigitos(linha.nip);
    if (!digits) continue;

    const existente = porNip.get(digits);
    if (existente && !substituir) {
      ignoradosDuplicados += 1;
      continue;
    }

    const novo = linhaRelacaoParaCadastro(linha, existente?.id);
    paraSalvar.push(novo);
    porNip.set(digits, novo);
  }

  if (paraSalvar.length > 0) {
    await addCadastrosEmLote(paraSalvar);
  }

  return {
    totalNoArquivo: linhas.length,
    importados: paraSalvar.length,
    ignoradosDuplicados,
    erros: [],
  };
}

/** Útil para testes com texto já extraído. */
export function cadastrosFromPdfText(texto: string): CadastroItemPersist[] {
  return linhasRelacaoParaCadastros(parseRelacaoCadastroPdfText(texto));
}
