import type { NavigatorScreenParams } from '@react-navigation/native';
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
  /** Corrida/natação: desistência = REPROVADO sem tempo. */
  desistencia?: boolean;
  /** Corrida: voltas marcadas no momento da desistência (nota REP. (n VOLTA/VOLTAS)). */
  voltasDesistencia?: number;
};

/** Abas principais (keep-alive). */
export type MainTabParamList = {
  Home: undefined;
  Cadastro: { abrirPlanilhaIncompletos?: boolean } | undefined;
  AplicarTAF: undefined;
  Resultados: undefined;
  Estatisticas: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  Normas: undefined;
  AplicacaoTAF: undefined;
  CadastroAplicador: undefined;
  Configuracoes: undefined;
  Login: undefined;
  CadastrarResultados: {
    resultados: ResultadoCorridaItem[];
    returnTo?: AppRouteName;
    aplicadorAssinatura?: AplicadorAssinaturaResumo;
  };
  /** Página pública de agendamento (acessível sem login). */
  AgendamentoPublico: undefined;
};

/** Rotas usadas pela chrome (barra/sidebar) e navigateTab. */
export type AppRouteName = keyof MainTabParamList | keyof RootStackParamList;

export const MAIN_TAB_ROUTES: ReadonlySet<keyof MainTabParamList> = new Set([
  'Home',
  'Cadastro',
  'AplicarTAF',
  'Resultados',
  'Estatisticas',
]);

export function isMainTabRoute(name: string): name is keyof MainTabParamList {
  return MAIN_TAB_ROUTES.has(name as keyof MainTabParamList);
}
