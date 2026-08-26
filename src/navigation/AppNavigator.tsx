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
import { peekProvaAtivaSession } from '../services/provaAtivaSessionStorage';
import type { AppRouteName, RootStackParamList } from './types';
import { isMainTabRoute } from './types';
import { MainTabNavigator } from './MainTabNavigator';

export type { ResultadoCorridaItem, RootStackParamList } from './types';

import NormasScreen from '../screens/NormasScreen';
import AplicacaoTAFScreen from '../screens/AplicacaoTAFScreen';
import CadastroAplicadorScreen from '../screens/CadastroAplicadorScreen';
import ConfiguracoesScreen from '../screens/ConfiguracoesScreen';
import LoginScreen from '../screens/LoginScreen';
import CadastrarResultadosScreen from '../screens/CadastrarResultadosScreen';
import AgendamentoPublicoScreen from '../screens/AgendamentoPublicoScreen';
import { useAuth } from '../contexts/AuthContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

const BOTTOM_BAR_PADDING = 96;

/**
 * Deep-link / URL routing.
 * A página pública de agendamento NÃO entra no SPA: é um HTML estático
 * em /apptaf/agendamento.html (militares sem acesso ao sistema).
 */
const LINKING_CONFIG = {
  prefixes: [
    'https://thiagod11lopes-ops.github.io',
    'http://localhost:8081',
    'http://localhost:19006',
    'taf-app://',
  ],
  config: {
    screens: {
      MainTabs: {
        screens: {
          Home: '',
        },
      },
    },
  },
};

export default function AppNavigator() {
  const { theme, isDark } = useTheme();
  const { authReady, isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const { useSidebarShell } = useDeviceLayout();
  const [activeRoute, setActiveRoute] = useState<AppRouteName>('Login');
  const showAppChrome = authReady && isAuthenticated;
  const topChromeExtra =
    isMainTabRoute(activeRoute) ||
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
      return;
    }
    if (!authReady || !isAuthenticated) {
      navigateTab('Login');
      return;
    }
    if (peekProvaAtivaSession()) {
      navigateTab('AplicarTAF');
    }
  }, [syncRoute, authReady, isAuthenticated]);

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

  const fullWidth =
    activeRoute === 'Cadastro' ||
    activeRoute === 'CadastroAplicador' ||
    activeRoute === 'AplicarTAF';

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      linking={LINKING_CONFIG}
      onReady={handleNavReady}
      onStateChange={syncRoute}
    >
      <AuthLoginRouteGate />
      <View style={styles.shell}>
        <View style={styles.shellForeground}>
        <AppShell activeRoute={activeRoute} fullWidth={fullWidth}>
          <Stack.Navigator
            initialRouteName="Login"
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
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="Normas" component={NormasScreen} />
          <Stack.Screen name="AplicacaoTAF" component={AplicacaoTAFScreen} />
          <Stack.Screen name="CadastroAplicador" component={CadastroAplicadorScreen} />
          <Stack.Screen
            name="CadastrarResultados"
            component={CadastrarResultadosScreen}
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, backgroundColor: 'transparent' },
            }}
          />
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
          <Stack.Screen
            name="AgendamentoPublico"
            component={AgendamentoPublicoScreen}
            options={{
              contentStyle: { flex: 1, paddingBottom: 0, paddingTop: 0, backgroundColor: 'transparent' },
            }}
          />
          </Stack.Navigator>
        </AppShell>
        {showAppChrome ? <SettingsTopButton activeRoute={activeRoute} /> : null}
        {showAppChrome ? <GlassBottomBar activeRoute={activeRoute} /> : null}
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
