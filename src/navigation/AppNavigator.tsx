import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import NormasScreen from '../screens/NormasScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';
import CadastrarResultadosScreen from '../screens/CadastrarResultadosScreen';

/** Linha de resultado da prova (enviada para cadastro). */
export type ResultadoCorridaItem = {
  corredor: number;
  nome: string;
  tempoMs: number;
  nip: string;
  /** Define rótulos na tela de resumo e coluna no cadastro (corrida vs natação). */
  prova?: 'corrida' | 'natacao';
  /** Nota da prova (corrida ou natação feminina), se calculada nesta sessão */
  notaTexto?: string;
  /** Campo NORA exibido no fluxo de rúbrica da natação. */
  noraTexto?: string;
  /** Texto de reprovação no fluxo de rúbrica da natação (se houver). */
  reprovacaoTexto?: string;
  /** Rúbrica digitada no modal sequencial da natação. */
  rubricaCandidato?: string;
  /** Rúbrica desenhada no modal sequencial da natação (SVG data URL). */
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

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { theme, isDark } = useTheme();

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Normas" component={NormasScreen} />
        <Stack.Screen name="Cadastro" component={CadastroScreenModern} />
        <Stack.Screen name="AplicacaoTAF" component={AplicacaoTAFScreen} />
        <Stack.Screen name="AplicarTAF" component={AplicarTAFScreen} />
        <Stack.Screen name="CadastrarResultados" component={CadastrarResultadosScreen} />
        <Stack.Screen name="Estatisticas" component={EstatisticasScreen} />
        <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
