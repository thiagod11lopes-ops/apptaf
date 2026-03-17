import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import HomeScreen from '../screens/HomeScreen';
import NormasScreen from '../screens/NormasScreen';
import CadastroScreen from '../screens/CadastroScreen';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';

export type RootStackParamList = {
  Home: undefined;
  Normas: undefined;
  Cadastro: undefined;
  AplicacaoTAF: undefined;
  Estatisticas: undefined;
  Configuracoes: undefined;
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
        <Stack.Screen name="Cadastro" component={CadastroScreen} />
        <Stack.Screen name="AplicacaoTAF" component={AplicacaoTAFScreen} />
        <Stack.Screen name="Estatisticas" component={EstatisticasScreen} />
        <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
