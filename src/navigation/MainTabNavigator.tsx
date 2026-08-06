import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import type { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CadastroScreenModern from '../screens/CadastroScreenModern';
import AplicarTAFScreen from '../screens/AplicarTAFScreen';
import ResultadosScreen from '../screens/ResultadosScreen';
import EstatisticasScreen from '../screens/EstatisticasScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * O bottom-tabs no web mantém abas visitadas com absoluteFill + zIndex -1.
 * Com fundo transparente do AppShell, as telas de baixo vazam por cima umas das outras.
 * Aqui a aba sem foco some de verdade (display:none / sem filhos).
 */
function TabSceneVisibilityGate({ children }: { children: React.ReactNode }) {
  const focused = useIsFocused();

  if (!focused) {
    return (
      <View
        style={styles.hiddenScene}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        {...(Platform.OS === 'web' ? ({ inert: true } as object) : null)}
      />
    );
  }

  return <View style={styles.visibleScene}>{children}</View>;
}

/**
 * Abas principais. A barra visual continua em GlassBottomBar / Sidebar.
 */
export function MainTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={() => null}
      detachInactiveScreens
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        screenLayout: ({ children }) => (
          <TabSceneVisibilityGate>{children}</TabSceneVisibilityGate>
        ),
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cadastro" component={CadastroScreenModern} />
      <Tab.Screen name="AplicarTAF" component={AplicarTAFScreen} />
      <Tab.Screen name="Resultados" component={ResultadosScreen} />
      <Tab.Screen name="Estatisticas" component={EstatisticasScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  visibleScene: {
    flex: 1,
  },
  hiddenScene: {
    ...StyleSheet.absoluteFillObject,
    // web: some o nó da árvore visual; nativo: sem área/opacidade
    ...(Platform.OS === 'web'
      ? ({ display: 'none' } as object)
      : { opacity: 0, overflow: 'hidden' }),
  },
});
