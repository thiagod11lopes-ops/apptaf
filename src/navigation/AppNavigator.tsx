import React, { useCallback, useState } from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { GlassBottomBar } from '../components/premium/GlassBottomBar';
import { SettingsTopButton } from '../components/premium/SettingsTopButton';
import { AppShell } from '../components/sismav/AppShell';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { navigationRef, getCurrentRouteName, navigateTab } from './navigationRef';
import { AuthLoginRouteGate } from './AuthLoginRouteGate';
import { hasPendingAuthCallback } from '../services/firebase/googleAuth';
import type { RootStackParamList } from './types';

export type { ResultadoCorridaItem, RootStackParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import NormasScreen from '../screens/NormasScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import CadastroAplicadorScreen from '../screens/CadastroAplicadorScreen';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';
import LoginScreen from '../screens/LoginScreen';
import ResultadosScreen from '../screens/ResultadosScreen';
import CadastrarResultadosScreen from '../screens/CadastrarResultadosScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BOTTOM_BAR_PADDING = 96;

export default function AppNavigator() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { useSidebarShell } = useDeviceLayout();
  const [activeRoute, setActiveRoute] = useState<keyof RootStackParamList>('Home');
  const topChromeExtra =
    activeRoute === 'Home' ||
    activeRoute === 'Cadastro' ||
    activeRoute === 'AplicarTAF' ||
    activeRoute === 'Resultados' ||
    activeRoute === 'Estatisticas' ||
    activeRoute === 'Normas' ||
    activeRoute === 'AplicacaoTAF' ||
    activeRoute === 'CadastroAplicador'
      ? 8
      : 52;
  const topChromePad = useSidebarShell
    ? Math.max(insets.top, 8) + 8
    : Math.max(insets.top, 8) + topChromeExtra;
  const bottomPad = useSidebarShell ? 24 : BOTTOM_BAR_PADDING;

  const syncRoute = useCallback(() => {
    setActiveRoute(getCurrentRouteName());
  }, []);

  const handleNavReady = useCallback(() => {
    syncRoute();
    if (hasPendingAuthCallback()) {
      navigateTab('Login');
    }
  }, [syncRoute]);

  const navTheme = {
    ...DefaultTheme,
    dark: isDark,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: 'transparent',
      card: 'transparent',
      text: theme.text,
      border: theme.border,
      notification: theme.primary,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={handleNavReady}
      onStateChange={syncRoute}
    >
      <AuthLoginRouteGate />
      <View style={styles.shell}>
        <View style={styles.shellForeground}>
        <AppShell
          activeRoute={activeRoute}
          fullWidth={activeRoute === 'Cadastro' || activeRoute === 'CadastroAplicador' || activeRoute === 'AplicarTAF'}
        >
          <Stack.Navigator
            initialRouteName="Home"
            screenOptions={{
              headerShown: false,
              contentStyle: {
                flex: 1,
                backgroundColor: 'transparent',
                paddingBottom: bottomPad,
                paddingTop: topChromePad,
              },
              animation: Platform.OS === 'web' ? 'fade' : 'slide_from_right',
            }}
          >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Normas" component={NormasScreen} />
          <Stack.Screen name="Cadastro" component={CadastroScreenModern} />
          <Stack.Screen name="AplicacaoTAF" component={AplicacaoTAFScreen} />
          <Stack.Screen name="CadastroAplicador" component={CadastroAplicadorScreen} />
          <Stack.Screen name="AplicarTAF" component={AplicarTAFScreen} />
          <Stack.Screen
            name="CadastrarResultados"
            component={CadastrarResultadosScreen}
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen name="Estatisticas" component={EstatisticasScreen} />
          <Stack.Screen name="Resultados" component={ResultadosScreen} />
          <Stack.Screen
            name="Configuracoes"
            component={ConfiguracoesScreen}
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, paddingTop: 0, backgroundColor: 'transparent' },
            }}
          />
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, paddingTop: 0, backgroundColor: 'transparent' },
            }}
          />
          </Stack.Navigator>
        </AppShell>
        <SettingsTopButton activeRoute={activeRoute} />
        <GlassBottomBar activeRoute={activeRoute} />
        </View>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: 0,
    overflow: Platform.OS === 'web' ? 'hidden' : 'visible',
    position: 'relative',
    backgroundColor: 'transparent',
  },
  shellForeground: {
    flex: 1,
    zIndex: 1,
    backgroundColor: 'transparent',
  },
});
