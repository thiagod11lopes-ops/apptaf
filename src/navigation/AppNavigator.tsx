import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { GlassBottomBar } from '../components/premium/GlassBottomBar';
import HomeScreen from '../screens/HomeScreen';
import NormasScreen from '../screens/NormasScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';
import CadastrarResultadosScreen from '../screens/CadastrarResultadosScreen';

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

const Stack = createNativeStackNavigator<RootStackParamList>();

const BOTTOM_BAR_PADDING = 96;

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
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme.background,
              paddingBottom: BOTTOM_BAR_PADDING,
            },
            animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Normas" component={NormasScreen} />
          <Stack.Screen name="Cadastro" component={CadastroScreenModern} />
          <Stack.Screen name="AplicacaoTAF" component={AplicacaoTAFScreen} />
          <Stack.Screen name="AplicarTAF" component={AplicarTAFScreen} />
          <Stack.Screen
            name="CadastrarResultados"
            component={CadastrarResultadosScreen}
            options={{ contentStyle: { paddingBottom: 0, backgroundColor: theme.background } }}
          />
          <Stack.Screen name="Estatisticas" component={EstatisticasScreen} />
          <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
        </Stack.Navigator>
        <GlassBottomBar />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
