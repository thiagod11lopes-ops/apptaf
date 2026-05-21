import React, { useCallback, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { GlassBottomBar } from '../components/premium/GlassBottomBar';
import { navigationRef, getCurrentRouteName } from './navigationRef';
import type { RootStackParamList } from './types';

export type { ResultadoCorridaItem, RootStackParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import NormasScreen from '../screens/NormasScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';
import CadastrarResultadosScreen from '../screens/CadastrarResultadosScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BOTTOM_BAR_PADDING = 96;

export default function AppNavigator() {
  const { theme, isDark } = useTheme();
  const [activeRoute, setActiveRoute] = useState<keyof RootStackParamList>('Home');

  const syncRoute = useCallback(() => {
    setActiveRoute(getCurrentRouteName());
  }, []);

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
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={syncRoute}
      onStateChange={syncRoute}
    >
      <View style={[styles.shell, { backgroundColor: theme.background }]}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: {
              flex: 1,
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
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, backgroundColor: theme.background },
            }}
          />
          <Stack.Screen name="Estatisticas" component={EstatisticasScreen} />
          <Stack.Screen name="Configuracoes" component={ConfiguracoesScreen} />
        </Stack.Navigator>
        <GlassBottomBar activeRoute={activeRoute} />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
