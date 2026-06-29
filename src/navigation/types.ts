import type { AplicadorAssinaturaResumo } from '../types/aplicadorAssinatura';

export type ResultadoCorridaItem = {
  corredor: number;
  nome: string;
  tempoMs: number;
  nip: string;
  prova?:
    | 'corrida'
    | 'natacao'
    | 'permanencia'
    | 'caminhada'
    | 'flexao_barra'
    | 'flexao_solo'
    | 'abdominal_remador'
    | 'abdominal_prancha';
  /** Repetições ou tempo textual (provas FN). */
  desempenhoTexto?: string;
  notaTexto?: string;
  noraTexto?: string;
  reprovacaoTexto?: string;
  rubricaCandidato?: string;
  rubricaCandidatoSvg?: string;
};

export type RootStackParamList = {
  Home: undefined;
  Normas: undefined;
  Cadastro: undefined;
  AplicacaoTAF: undefined;
  CadastroAplicador: undefined;
  AplicarTAF: undefined;
  Estatisticas: undefined;
  Resultados: undefined;
  Configuracoes: undefined;
  Login: undefined;
  CadastrarResultados: {
    resultados: ResultadoCorridaItem[];
    returnTo?: keyof RootStackParamList;
    aplicadorAssinatura?: AplicadorAssinaturaResumo;
  };
};
