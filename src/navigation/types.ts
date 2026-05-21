export type ResultadoCorridaItem = {
  corredor: number;
  nome: string;
  tempoMs: number;
  nip: string;
  prova?: 'corrida' | 'natacao';
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
  AplicarTAF: undefined;
  Estatisticas: undefined;
  Configuracoes: undefined;
  CadastrarResultados: { resultados: ResultadoCorridaItem[] };
};
